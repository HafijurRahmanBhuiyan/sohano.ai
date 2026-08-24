"""LLM provider abstraction.

Any provider implements ``stream_generate`` which yields text chunks
asynchronously given a list of conversation messages. The active provider is
selected via the LLM_PROVIDER env var ("anthropic" | "openai" | "mock").
"""

import base64
from abc import ABC, abstractmethod
from typing import AsyncIterator, Dict, List, Optional

from app.core.config import settings

SYSTEM_PROMPT = (
    "You are Sohano.ai, a friendly and highly capable AI assistant. "
    "When users ask who you are, introduce yourself as Sohano.ai. "
    "Give well-researched, accurate, clearly structured answers. "
    "Use Markdown formatting (headings, lists, tables, fenced code blocks with language tags) when it helps readability."
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
    def stream_generate(self, messages: List[LLMMessage]) -> AsyncIterator[str]:
        """Yield response text chunks asynchronously."""
        raise NotImplementedError

    async def generate_once(self, prompt: str) -> str:
        """Non-streaming convenience call used e.g. for image OCR/description."""
        chunks: List[str] = []
        async for chunk in self.stream_generate([LLMMessage(role="user", content=prompt)]):
            chunks.append(chunk)
        return "".join(chunks)


class AnthropicProvider(BaseLLMProvider):
    name = "anthropic"

    def __init__(self) -> None:
        import anthropic  # imported lazily so the dep is optional per provider

        self.client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        self.model = settings.llm_model

    async def stream_generate(self, messages: List[LLMMessage]) -> AsyncIterator[str]:
        api_messages: List[Dict[str, object]] = []
        for m in messages:
            if not m.content.strip() and not m.images:
                continue
            blocks: List[Dict[str, object]] = []
            for img in m.images:
                blocks.append(
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": img.media_type,
                            "data": img.data_b64,
                        },
                    }
                )
            if m.content.strip():
                blocks.append({"type": "text", "text": m.content})
            api_messages.append({"role": m.role, "content": blocks})

        async with self.client.messages.stream(
            model=self.model,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=api_messages,  # type: ignore[arg-type]
        ) as stream:
            async for text in stream.text_stream:
                yield text


class OpenAIProvider(BaseLLMProvider):
    name = "openai"

    def __init__(self) -> None:
        from openai import AsyncOpenAI

        self.client = AsyncOpenAI(api_key=settings.openai_api_key)
        self.model = settings.llm_model

    async def stream_generate(self, messages: List[LLMMessage]) -> AsyncIterator[str]:
        api_messages: List[Dict[str, object]] = [{"role": "system", "content": SYSTEM_PROMPT}]
        for m in messages:
            parts: List[Dict[str, object]] = [{"type": "text", "text": m.content}]
            for img in m.images:
                url = f"data:{img.media_type};base64,{img.data_b64}"
                parts.append({"type": "image_url", "image_url": {"url": url}})
            api_messages.append({"role": m.role, "content": parts})  # type: ignore[dict-item]

        stream = await self.client.chat.completions.create(
            model=self.model,
            messages=api_messages,  # type: ignore[arg-type]
            stream=True,
            max_tokens=4096,
        )
        async for event in stream:
            if event.choices and event.choices[0].delta and event.choices[0].delta.content:
                yield event.choices[0].delta.content


class MockProvider(BaseLLMProvider):
    """Offline provider for development/testing — no API key required."""

    name = "mock"

    async def stream_generate(self, messages: List[LLMMessage]) -> AsyncIterator[str]:
        last_user = next((m for m in reversed(messages) if m.role == "user"), None)
        question = (last_user.content[:300] if last_user else "your message") or "your message"
        reply = (
            f"**Sohano.ai (mock mode)** — no real LLM provider is configured, so this is a canned reply.\n\n"
            f"You asked:\n\n> {question}\n\n"
            "Set `LLM_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` in `backend/.env` to get real answers.\n\n"
            "```python\nprint('Hello from Sohano.ai!')\n```"
        )
        # Simulate token-by-token streaming.
        import asyncio

        for i in range(0, len(reply), 12):
            yield reply[i : i + 12]
            await asyncio.sleep(0.02)


_provider: Optional[BaseLLMProvider] = None


def encode_image_bytes(raw: bytes) -> str:
    return base64.standard_b64encode(raw).decode("ascii")


def get_llm_provider() -> BaseLLMProvider:
    global _provider
    if _provider is not None:
        return _provider
    name = settings.llm_provider.lower()
    try:
        if name == "anthropic":
            if not settings.anthropic_api_key:
                raise RuntimeError("ANTHROPIC_API_KEY is not set")
            _provider = AnthropicProvider()
        elif name == "openai":
            if not settings.openai_api_key:
                raise RuntimeError("OPENAI_API_KEY is not set")
            _provider = OpenAIProvider()
        else:
            _provider = MockProvider()
    except Exception as exc:  # fall back to mock so the app still works
        import logging

        logging.getLogger("sohano").warning(
            "Could not init LLM provider '%s' (%s); falling back to mock.", name, exc
        )
        _provider = MockProvider()
    return _provider


def reset_llm_provider() -> None:
    global _provider
    _provider = None
