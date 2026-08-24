"""LLM provider abstraction.

Any provider implements ``stream_generate`` which yields text chunks
asynchronously given a list of conversation messages. The active provider is
selected via the LLM_PROVIDER env var
("gemini" | "anthropic" | "openai" | "mock").
"""

import base64
from abc import ABC, abstractmethod
from typing import AsyncIterator, Dict, List, Optional

from app.core.config import settings


SYSTEM_PROMPT = (
    "You are Sohano.ai, a friendly and highly capable AI assistant. "
    "When users ask who you are, introduce yourself as Sohano.ai. "
    "Give well-researched, accurate, clearly structured answers. "
    "Use Markdown formatting (headings, lists, tables, fenced code blocks "
    "with language tags) when it helps readability."
)


IMAGE_MIME = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "webp": "image/webp",
    "gif": "image/gif",
}


class LLMImage:
    """An image attached to a user message (base64-encoded)."""

    def __init__(self, media_type: str, data_b64: str) -> None:
        self.media_type = media_type
        self.data_b64 = data_b64


class LLMMessage:
    def __init__(
        self,
        role: str,
        content: str,
        images: Optional[List[LLMImage]] = None,
    ) -> None:
        self.role = role  # "user" | "assistant"
        self.content = content
        self.images = images or []


class BaseLLMProvider(ABC):
    name = "base"

    @abstractmethod
    def stream_generate(
        self,
        messages: List[LLMMessage],
    ) -> AsyncIterator[str]:
        """Yield response text chunks asynchronously."""
        raise NotImplementedError

    async def generate_once(self, prompt: str) -> str:
        """Non-streaming convenience call used e.g. for image OCR/description."""
        chunks: List[str] = []

        async for chunk in self.stream_generate(
            [LLMMessage(role="user", content=prompt)]
        ):
            chunks.append(chunk)

        return "".join(chunks)


class AnthropicProvider(BaseLLMProvider):
    name = "anthropic"

    def __init__(self) -> None:
        import anthropic  # Lazy import so the dependency is optional per provider.

        if not settings.anthropic_api_key:
            raise RuntimeError("ANTHROPIC_API_KEY is not set")

        self.client = anthropic.AsyncAnthropic(
            api_key=settings.anthropic_api_key
        )
        self.model = settings.llm_model

    async def stream_generate(
        self,
        messages: List[LLMMessage],
    ) -> AsyncIterator[str]:
        api_messages: List[Dict[str, object]] = []

        for message in messages:
            if not message.content.strip() and not message.images:
                continue

            blocks: List[Dict[str, object]] = []

            for image in message.images:
                blocks.append(
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": image.media_type,
                            "data": image.data_b64,
                        },
                    }
                )

            if message.content.strip():
                blocks.append(
                    {
                        "type": "text",
                        "text": message.content,
                    }
                )

            api_messages.append(
                {
                    "role": message.role,
                    "content": blocks,
                }
            )

        async with self.client.messages.stream(
            model=self.model,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=api_messages,  # type: ignore[arg-type]
        ) as stream:
            async for text in stream.text_stream:
                yield text


class GeminiProvider(BaseLLMProvider):
    """Google Gemini provider using the official google-genai SDK."""

    name = "gemini"

    def __init__(self) -> None:
        from google import genai

        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is not set")

        self.client = genai.Client(
            api_key=settings.gemini_api_key
        )
        self.model = settings.llm_model

    async def stream_generate(
        self,
        messages: List[LLMMessage],
    ) -> AsyncIterator[str]:
        from google.genai import types

        contents: List[types.Content] = []

        for message in messages:
            if not message.content.strip() and not message.images:
                continue

            parts: List[types.Part] = []

            # Text content
            if message.content.strip():
                parts.append(
                    types.Part.from_text(
                        text=message.content
                    )
                )

            # Image content
            for image in message.images:
                try:
                    image_bytes = base64.b64decode(
                        image.data_b64
                    )

                    parts.append(
                        types.Part.from_bytes(
                            data=image_bytes,
                            mime_type=image.media_type,
                        )
                    )

                except Exception as exc:
                    raise RuntimeError(
                        f"Could not decode image for Gemini: {exc}"
                    ) from exc

            # Gemini uses "user" and "model" roles.
            role = (
                "model"
                if message.role == "assistant"
                else "user"
            )

            contents.append(
                types.Content(
                    role=role,
                    parts=parts,
                )
            )

        if not contents:
            return

        config = types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            max_output_tokens=4096,
        )

        # google-genai async streaming API.
        response = await self.client.aio.models.generate_content(
            model=self.model,
            contents=contents,
            config=config,
        )

        if response.text:
            yield response.text


class OpenAIProvider(BaseLLMProvider):
    name = "openai"

    def __init__(self) -> None:
        from openai import AsyncOpenAI

        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is not set")

        self.client = AsyncOpenAI(
            api_key=settings.openai_api_key
        )
        self.model = settings.llm_model

    async def stream_generate(
        self,
        messages: List[LLMMessage],
    ) -> AsyncIterator[str]:
        api_messages: List[Dict[str, object]] = [
            {
                "role": "system",
                "content": SYSTEM_PROMPT,
            }
        ]

        for message in messages:
            parts: List[Dict[str, object]] = []

            if message.content.strip():
                parts.append(
                    {
                        "type": "text",
                        "text": message.content,
                    }
                )

            for image in message.images:
                url = (
                    f"data:{image.media_type};base64,"
                    f"{image.data_b64}"
                )

                parts.append(
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": url
                        },
                    }
                )

            if not parts:
                continue

            api_messages.append(
                {
                    "role": message.role,
                    "content": parts,
                }
            )  # type: ignore[dict-item]

        stream = await self.client.chat.completions.create(
            model=self.model,
            messages=api_messages,  # type: ignore[arg-type]
            stream=True,
            max_tokens=4096,
        )

        async for event in stream:
            if not event.choices:
                continue

            delta = event.choices[0].delta

            if delta and delta.content:
                yield delta.content


class MockProvider(BaseLLMProvider):
    """Offline provider for development/testing — no API key required."""

    name = "mock"

    async def stream_generate(
        self,
        messages: List[LLMMessage],
    ) -> AsyncIterator[str]:
        last_user = next(
            (
                message
                for message in reversed(messages)
                if message.role == "user"
            ),
            None,
        )

        question = (
            last_user.content[:300]
            if last_user
            else "your message"
        ) or "your message"

        reply = (
            "**Sohano.ai (mock mode)** — no real LLM provider "
            "is configured, so this is a canned reply.\n\n"
            f"You asked:\n\n> {question}\n\n"
            "Set `LLM_PROVIDER=gemini` and `GEMINI_API_KEY` "
            "in `backend/.env` to get real answers.\n\n"
            "```python\n"
            "print('Hello from Sohano.ai!')\n"
            "```"
        )

        # Simulate token-by-token streaming.
        import asyncio

        for index in range(0, len(reply), 12):
            yield reply[index : index + 12]
            await asyncio.sleep(0.02)


_provider: Optional[BaseLLMProvider] = None


def encode_image_bytes(raw: bytes) -> str:
    """Encode raw image bytes as a base64 ASCII string."""
    return base64.standard_b64encode(raw).decode("ascii")


def get_llm_provider() -> BaseLLMProvider:
    """Return the configured LLM provider.

    Supported providers:
        - gemini
        - anthropic
        - openai
        - mock

    If the selected provider cannot be initialized, the application
    falls back to MockProvider so the server can still start.
    """
    global _provider

    if _provider is not None:
        return _provider

    name = settings.llm_provider.lower().strip()

    try:
        if name == "gemini":
            if not settings.gemini_api_key:
                raise RuntimeError(
                    "GEMINI_API_KEY is not set"
                )

            _provider = GeminiProvider()

        elif name == "anthropic":
            if not settings.anthropic_api_key:
                raise RuntimeError(
                    "ANTHROPIC_API_KEY is not set"
                )

            _provider = AnthropicProvider()

        elif name == "openai":
            if not settings.openai_api_key:
                raise RuntimeError(
                    "OPENAI_API_KEY is not set"
                )

            _provider = OpenAIProvider()

        elif name == "mock":
            _provider = MockProvider()

        else:
            raise RuntimeError(
                f"Unsupported LLM_PROVIDER: {name}"
            )

    except Exception as exc:
        import logging

        logging.getLogger("sohano").warning(
            "Could not init LLM provider '%s' (%s); "
            "falling back to mock.",
            name,
            exc,
        )

        _provider = MockProvider()

    return _provider


def reset_llm_provider() -> None:
    """Reset the cached provider instance."""
    global _provider
    _provider = None