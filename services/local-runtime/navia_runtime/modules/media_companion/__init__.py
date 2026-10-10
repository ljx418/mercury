"""V3 Media Companion runtime boundaries."""

from .credential_transport import (
    CredentialChannelStore,
    CredentialLeaseStore,
    MediaCredentialAuthenticator,
    MediaCredentialFailure,
)
from .outline import DeterministicExtractiveOutlineGenerator, MediaOutlineError, validate_outline_bundle
from .product_materializer import MediaProductMaterializer
from .workspace_candidate import build_ask_benchmark, build_candidate_core, candidate_core_sha256
from .task_store import MediaTaskStore, MediaTaskStoreError

__all__ = [
    "CredentialChannelStore", "CredentialLeaseStore", "MediaCredentialAuthenticator", "MediaCredentialFailure",
    "DeterministicExtractiveOutlineGenerator", "MediaOutlineError", "MediaProductMaterializer", "validate_outline_bundle",
    "build_ask_benchmark", "build_candidate_core", "candidate_core_sha256",
    "MediaTaskStore", "MediaTaskStoreError",
]
