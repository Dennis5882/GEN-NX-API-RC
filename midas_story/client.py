"""MIDAS Gen NX Open API 클라이언트.

MidasClient   — 실제 REST 전송 (requests 필요, Gen NX 실행 + MAPI-Key 필요).
RecordingClient — 전송 없이 Operation 을 기록(테스트/미리보기용). 가짜 응답 반환.

전개기와 분리되어 있어, build()→run() 으로 I/O 경계를 명확히 둔다.
"""
from __future__ import annotations

import os

DEFAULT_BASE_URL = "https://moa-engineers.midasit.com:443/gen"  # Gen NX


class RecordingClient:
    """네트워크 없이 호출만 기록한다.

    operations: 전달된 Operation 목록 보관 (검증/스냅샷 테스트, 드라이런).
    """

    def __init__(self) -> None:
        self.operations: list = []

    def run(self, operations: list) -> list:
        responses = []
        for op in operations:
            self.operations.append(op)
            responses.append({"status": "recorded", "command": op.command})
        return responses

    def calls(self) -> list:
        """(method, command) 튜플 목록."""
        return [(op.method, op.command) for op in self.operations]


class MidasClient:
    """실제 MIDAS Gen NX 서버로 전송.

    base_url: 예) https://moa-engineers.midasit.com:443/gen  (Civil 은 .../civil)
    mapi_key: Gen NX 앱에서 발급. 미지정 시 환경변수 MIDAS_MAPI_KEY 사용.
    """

    def __init__(self, mapi_key: str | None = None, base_url: str | None = None,
                 timeout: float = 30.0) -> None:
        self.base_url = (base_url or os.getenv("MIDAS_BASE_URL", DEFAULT_BASE_URL)).rstrip("/")
        self.mapi_key = mapi_key or os.getenv("MIDAS_MAPI_KEY", "")
        self.timeout = timeout
        if not self.mapi_key:
            raise ValueError(
                "MAPI-Key 가 필요합니다. MidasClient(mapi_key=...) 또는 환경변수 MIDAS_MAPI_KEY 설정."
            )

    def _headers(self) -> dict:
        return {"Content-Type": "application/json", "MAPI-Key": self.mapi_key}

    def call(self, method: str, command: str, body: dict | None = None) -> dict:
        import requests  # 지연 import — 코어는 requests 비의존

        url = self.base_url + command
        fn = getattr(requests, method.lower())
        kwargs = {"headers": self._headers(), "timeout": self.timeout}
        if method.upper() in ("POST", "PUT") and body is not None:
            kwargs["json"] = body
        res = fn(url, **kwargs)
        try:
            data = res.json()
        except ValueError:
            data = {"raw": res.text}
        return {"status_code": res.status_code, "data": data}

    def run(self, operations: list, stop_on_error: bool = True) -> list:
        """Operation 목록을 순서대로 전송. 각 응답을 반환."""
        responses = []
        for op in operations:
            res = self.call(op.method, op.command, op.body)
            responses.append(res)
            if stop_on_error and res["status_code"] >= 400:
                raise RuntimeError(
                    f"{op.method} {op.command} 실패: {res['status_code']} {res['data']}"
                )
        return responses
