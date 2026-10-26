"""R6-G2 owned-browser Runtime bootstrap.

This module seeds only the prerequisite acquisition state through the
production coordinator API. Grants, tickets, WebSockets, capture sinks and
cleanup remain owned by the normal FastAPI application.
"""

from __future__ import annotations

import json
import os

from navia_runtime import app as runtime_app
from navia_runtime.modules.media_companion.acquisition.coordinator import request_from_payload


def _seed() -> None:
    scenarios = json.loads(os.environ.get("NAVIA_R6_G2_SCENARIOS", "[]"))
    for scenario in scenarios:
        task_id = scenario["taskId"]
        runtime_app.media_acquisition_coordinator.create(request_from_payload(scenario))
        runtime_app.media_acquisition_coordinator.record_route_failure(
            task_id, "credentialed_subtitle", "V3_MEDIA_SUBTITLE_UNAVAILABLE"
        )
        runtime_app.media_acquisition_coordinator.record_route_failure(
            task_id, "credentialed_media_asr", "V3_MEDIA_RUNTIME_OFFLINE"
        )
        runtime_app.media_acquisition_coordinator.record_route_failure(
            task_id, "public_or_page_subtitle", "V3_MEDIA_SUBTITLE_UNAVAILABLE"
        )


_seed()
app = runtime_app.app
