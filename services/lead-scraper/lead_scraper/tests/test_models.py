from __future__ import annotations

from lead_scraper.models import Lead


def test_model_normalization_helpers() -> None:
  lead = Lead(
    name="A",
    email=" Test@Email.com ",
    phone="(919) 555-1200",
    need_type="x",
    source="court",
  )

  assert lead.normalized_email() == "test@email.com"
  assert lead.normalized_phone_digits() == "9195551200"
