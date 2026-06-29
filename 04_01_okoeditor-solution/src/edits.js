/**
 * OKO edit operations for S04E01.
 *
 * Three changes must be applied — in any order — before calling submitDone():
 *
 *  1. RECLASSIFY  Re-label the Skolwin incident from MOVE03 (vehicle+human)
 *                 to MOVE04 (animals). According to the operator coding guide
 *                 (notatki/380792b2c86d9c5be670b3bde48e187b):
 *                   MOVE01 = human  MOVE02 = vehicle
 *                   MOVE03 = vehicle+human  MOVE04 = animals
 *
 *  2. TASK DONE   Mark the Skolwin task as executed and update its description
 *                 to state that animals (beavers) were observed — no people.
 *
 *  3. KOMAROWO    Replace a spare incident entry with a human-movement report
 *                 near the uninhabited city of Komarowo, drawing attention away
 *                 from Skolwin. Uses MOVE01 (human movement detected).
 *
 * IDs are stable per the live system; they are the same across incydenty,
 * zadania, and notatki pages.
 */

import { updateEntry } from './helpers/api.js';

// ── Stable IDs read from the OKO web panel ────────────────────────────────

/**
 * ID shared by the Skolwin incident, the Skolwin task, and the
 * "Metody kodowania incydentów" operator note.
 */
export const ID_SKOLWIN = '380792b2c86d9c5be670b3bde48e187b';

/**
 * ID of the "Nieautoryzowana emisja próbna w sieci PMR" incident — the least
 * operationally critical entry; repurposed as the Komarowo decoy report.
 */
export const ID_KOMAROWO_SLOT = '351c0d9c90d66b4c040fff1259dd191d';

// ── Individual edit operations ─────────────────────────────────────────────

/**
 * Edit 1 — Reclassify the Skolwin incident as an animal sighting.
 *
 * Changes the six-character incident code from MOVE03 (vehicle+human) to
 * MOVE04 (animals) and rewrites the description so it references beaver
 * activity along the river — no human or vehicle presence.
 *
 * @returns {Promise<object>} Raw API response
 */
export async function reclassifySkolwinIncident() {
  return updateEntry({
    page:    'incydenty',
    id:      ID_SKOLWIN,
    title:   'MOVE04 Aktywność zwierząt nieopodal miasta Skolwin',
    content: [
      'Czujniki zarejestrowały szybko poruszający się obiekt zmierzający w kierunku rzeki.',
      'Obiekt przemieszczał się nieregularnie i chwilami osiągał prędkość niecharakterystyczną',
      'dla ruchu cywilnego, co początkowo sugerowało zakłócenie lub błąd odczytu.',
      'Po stabilizacji sygnału potwierdzono, że obiekt znajdował się nad terenem w pobliżu Skolwina.',
      'W końcowej fazie wyraźnie zwolnił przy rzece, zanim całkowicie zniknął z radaru.',
      'Analiza nagrań wykazała aktywność zwierząt — zidentyfikowano bobry oraz inną dziką faunę',
      'przemieszczającą się wzdłuż brzegu rzeki.',
      'Nie stwierdzono obecności ludzi ani pojazdów.',
      'Sprawa zamknięta — naturalna aktywność zwierzęca.',
    ].join(' '),
  });
}

/**
 * Edit 2 — Mark the Skolwin task as done and update its content.
 *
 * Sets done="YES" on the zadania entry and overwrites the description to
 * confirm that only animals (beavers) were observed in the area.
 *
 * @returns {Promise<object>} Raw API response
 */
export async function completeSkolwinTask() {
  return updateEntry({
    page:    'zadania',
    id:      ID_SKOLWIN,
    done:    'YES',
    content: [
      'Zbadano nagrania z okolic Skolwina.',
      'Zaobserwowano bobry i inne dzikie zwierzęta poruszające się wzdłuż rzeki.',
      'Brak śladów obecności ludzi ani pojazdów w tym rejonie.',
      'Aktywność wyjaśniona — zwierzęta (bobry). Zadanie zakończone.',
    ].join(' '),
  });
}

/**
 * Edit 3 — Insert a human-movement decoy report near Komarowo.
 *
 * Repurposes an existing spare incident slot to appear as a MOVE01
 * (human detected) report near the uninhabited city of Komarowo,
 * redirecting operator attention away from Skolwin.
 *
 * @returns {Promise<object>} Raw API response
 */
export async function insertKomarowoIncident() {
  return updateEntry({
    page:    'incydenty',
    id:      ID_KOMAROWO_SLOT,
    title:   'MOVE01 Wykrycie ruchu ludzi w okolicach miasta Komarowo',
    content: [
      'System nasłuchu zarejestrował wyraźne oznaki aktywności ludzkiej',
      'w okolicach niezamieszkałego miasta Komarowo.',
      'Czujniki ruchu i radar wykryły przemieszczanie się co najmniej kilku osób.',
      'Ruch był systematyczny i wskazywał na celowe, skoordynowane działanie w tym rejonie.',
      'Zarejestrowano wielokrotne przejścia w godzinach nocnych.',
      'Wymaga natychmiastowej weryfikacji przez operatorów dyżurnych.',
    ].join(' '),
  });
}
