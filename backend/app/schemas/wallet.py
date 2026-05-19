import uuid
import re
from datetime import datetime
from pydantic import BaseModel, field_validator

MALAYSIA_BANKS: dict[str, tuple[int, int]] = {
    "Maybank": (12, 12),
    "CIMB Bank": (14, 14),
    "Public Bank": (10, 10),
    "RHB Bank": (14, 14),
    "Hong Leong Bank": (12, 12),
    "AmBank": (12, 12),
    "Alliance Bank": (12, 12),
    "Affin Bank": (16, 16),
    "Bank Islam": (16, 16),
    "Bank Muamalat": (16, 16),
    "Bank Rakyat": (16, 16),
    "BSN (Bank Simpanan Nasional)": (16, 16),
    "Agrobank": (11, 11),
    "OCBC Bank Malaysia": (10, 10),
    "UOB Malaysia": (11, 11),
    "Standard Chartered Malaysia": (8, 12),
    "HSBC Bank Malaysia": (12, 12),
    "Citibank Malaysia": (10, 10),
    "Kuwait Finance House": (16, 16),
    "MBSB Bank": (16, 16),
}


class WalletResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    available_balance: float
    pending_balance: float  # computed from active sessions
    updated_at: datetime

    model_config = {"from_attributes": True}


class TransactionResponse(BaseModel):
    id: uuid.UUID
    type: str
    amount: float
    description: str
    reference_id: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class BankAccountRequest(BaseModel):
    bank_name: str
    account_number: str
    account_holder_name: str

    @field_validator("bank_name")
    @classmethod
    def validate_bank_name(cls, v: str) -> str:
        if v not in MALAYSIA_BANKS:
            raise ValueError(
                f"'{v}' is not a recognised Malaysian bank. "
                f"Accepted banks: {', '.join(MALAYSIA_BANKS)}"
            )
        return v

    @field_validator("account_number")
    @classmethod
    def validate_account_number(cls, v: str) -> str:
        digits = v.replace(" ", "")
        if not digits.isdigit():
            raise ValueError("Account number must contain digits only.")
        return digits

    @field_validator("account_holder_name")
    @classmethod
    def validate_account_holder_name(cls, v: str) -> str:
        name = v.strip()
        if len(name) < 2:
            raise ValueError("Account holder name is too short.")
        if not re.match(r"^[A-Za-z\s'@/\-]+$", name):
            raise ValueError("Account holder name must contain only letters and spaces.")
        return name

    @classmethod
    def model_post_init(cls, __context):
        pass  # cross-field validation handled in the API layer

    def validate_account_length(self) -> None:
        """Call after both bank_name and account_number are validated."""
        if self.bank_name not in MALAYSIA_BANKS:
            return  # already caught above
        min_len, max_len = MALAYSIA_BANKS[self.bank_name]
        length = len(self.account_number)
        if not (min_len <= length <= max_len):
            label = str(min_len) if min_len == max_len else f"{min_len}–{max_len}"
            raise ValueError(
                f"{self.bank_name} account numbers must be {label} digits "
                f"(got {length})."
            )


class BankAccountResponse(BaseModel):
    id: uuid.UUID
    bank_name: str
    account_number: str         # masked on read
    account_holder_name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class WithdrawalRequestCreate(BaseModel):
    amount: float


class WithdrawalResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    amount: float
    status: str
    bank_name: str
    account_number: str
    account_holder_name: str
    admin_notes: str | None
    processed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
