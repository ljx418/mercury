"""WP-A media dependency readiness."""

from .catalog import DEPENDENCY_DESCRIPTORS, DEPENDENCY_IDS
from .contracts import (
    DEPENDENCY_STATUS_SCHEMA_VERSION,
    MediaDependencyError,
    VerifiedDependencySnapshot,
)
from .manager import MediaDependencyManager, build_media_dependency_manager

__all__ = [
    "DEPENDENCY_DESCRIPTORS",
    "DEPENDENCY_IDS",
    "DEPENDENCY_STATUS_SCHEMA_VERSION",
    "MediaDependencyError",
    "MediaDependencyManager",
    "VerifiedDependencySnapshot",
    "build_media_dependency_manager",
]
