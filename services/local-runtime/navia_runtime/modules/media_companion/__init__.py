"""V3 Media Companion runtime boundaries."""

from .credential_transport import (
    CredentialChannelStore,
    CredentialLeaseStore,
    MediaCredentialAuthenticator,
    MediaCredentialFailure,
)
from .outline import DeterministicExtractiveOutlineGenerator, MediaOutlineError, validate_outline_bundle
from .product_materializer import MediaProductMaterializer
from .task_store import MediaTaskStore, MediaTaskStoreError

__all__ = [
    "CredentialChannelStore", "CredentialLeaseStore", "MediaCredentialAuthenticator", "MediaCredentialFailure",
    "DeterministicExtractiveOutlineGenerator", "MediaOutlineError", "MediaProductMaterializer", "validate_outline_bundle",
    "MediaTaskStore", "MediaTaskStoreError",
]
