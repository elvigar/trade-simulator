from app.llm.prompts import SYSTEM_PROMPT, build_messages


def test_build_messages_order_and_roles():
    history = [{"role": "user", "content": "hi"}, {"role": "assistant", "content": "hello"}]

    messages = build_messages("CONTEXT_TEXT", history, "what's my portfolio?")

    assert messages[0]["role"] == "system"
    assert "CONTEXT_TEXT" in messages[0]["content"]
    assert SYSTEM_PROMPT.strip().splitlines()[0] in messages[0]["content"]
    assert messages[1] == history[0]
    assert messages[2] == history[1]
    assert messages[-1] == {"role": "user", "content": "what's my portfolio?"}
    assert len(messages) == len(history) + 2


def test_build_messages_with_no_history():
    messages = build_messages("CONTEXT_TEXT", [], "hi")
    assert len(messages) == 2
    assert messages[0]["role"] == "system"
    assert messages[1] == {"role": "user", "content": "hi"}
