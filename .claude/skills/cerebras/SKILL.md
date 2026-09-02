---
name: cerebras-inference
description: Use this to write code to call an LLM using LiteLLM and OpenRouter with the Cerebras inference provider
---

# Calling an LLM via Cerebras

These instructions allow you write code to call an LLM with Cerebras specified as the inference provider.  
This method uses LiteLLM and OpenRouter.

## Setup

The OPENAI_API_KEY must be set in the .env file and loaded in as an environment variable, and passed explicitly as the `api_key` argument to `completion()` (LiteLLM's `openrouter/` model prefix normally expects `OPENROUTER_API_KEY`, so this project's single-key convention requires the explicit override).  

The uv project must include litellm and pydantic.
`uv add litellm pydantic`

## Code snippets

Use code like these examples in order to use Cerebras.

### Imports and constants

```python
from litellm import completion
MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}
```

### Code to call via Cerebras for a text response

```python
api_key = os.environ["OPENAI_API_KEY"]
response = completion(model=MODEL, messages=messages, reasoning_effort="low", extra_body=EXTRA_BODY, api_key=api_key)
result = response.choices[0].message.content
```

### Code to call via Cerebras for a Structured Outputs response

```python
api_key = os.environ["OPENAI_API_KEY"]
response = completion(model=MODEL, messages=messages, response_format=MyBaseModelSubclass, reasoning_effort="low", extra_body=EXTRA_BODY, api_key=api_key)
result = response.choices[0].message.content
result_as_object = MyBaseModelSubclass.model_validate_json(result)
```