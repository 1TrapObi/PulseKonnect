from __future__ import annotations

from abc import ABC, abstractmethod

from ..models import Lead


class BaseScraper(ABC):
  name: str

  @abstractmethod
  def scrape(self) -> list[Lead]:
    raise NotImplementedError
