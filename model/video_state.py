from dataclasses import dataclass,asdict
from enum import Enum,auto

# Enumを継承
class Status(Enum):
    IDLE=auto()
    DOWNLOADING=auto()
    READY=auto()
    ERROR=auto()

@dataclass
class VideoState:
    status:Status=Status.IDLE
    requested_quality:int | None=None
    actual_height:int | None=None #intもしくはNoneが入る。初期値はNone
    filepath:str | None=None
    progress:float=0.0
    error_message:str| None=None
    