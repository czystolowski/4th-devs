# Transkrypcja — S04E01

Cześć! Wyobraź sobie taką sytuację.

Masz agenta AI podłączonego do firmowej bazy wiedzy. Ktoś z zespołu pyta go, które projekty zależą od API płatności, które właśnie zmieniliśmy. Agent odpowiada pewnie i wymienia trzy projekty. Problem w tym, że w rzeczywistości tych projektów jest osiem. Trzy, które zwrócił, akurat zawierały w opisie słowo „płatności". Pozostałe pięć korzysta z tego API, ale ich dokumentacja mówi o rozliczeniach, fakturach albo transakcjach. Wektor Search znalazł semantyczne podobieństwo do słowa „płatności" i na tym poprzestał. O zależnościach między komponentami i o tym, że projekt X wywołuje endpoint Y, nie wiedział nic — bo te relacje nie istnieją w przestrzeni wektorowej. Są w grafie zależności, którego nikt nie zbudował.

To jest scenariusz, który spotykam regularnie. Nie dlatego, że ludzie wybierają złe narzędzia, ale dlatego, że wybierają jedno narzędzie do wszystkich typów pytań. A typy pytań w systemach AI to zupełnie różne bestie.

Kiedy budujesz pamięć dla systemu AI, musisz zrozumieć jedną ważną rzecz: nie ma jednej strategii wyszukiwania, która obsłuży wszystko dobrze. I nie mówię tu o edge case'ach, a o trzech podstawowych typach zapytań, z którymi każdy system AI spotyka się na co dzień.

Pierwszy typ to pytania o podobieństwo. „Znajdź dokumenty związane z RODO." „Pokaż mi maile dotyczące projektu Delta." „Czy orzeł 1 miał dwa silniki, czy jeden?" Tu wektory działają świetnie, bo to jest ich naturalne środowisko. Zamieniasz tekst na embedding, szukasz najbliższych sąsiadów w przestrzeni wektorowej i dostajesz wyniki posortowane po semantycznym podobieństwie.

Drugi typ to pytania o relacje. „Kto raportuje do Maurycjusza?", „Które mikroserwisy wywołują ten endpoint?", „Jakie są zależności między komponentem A i komponentem B?" Tu wektory są bezradne, bo relacja „raportuje do" nie jest kwestią semantycznej bliskości, tylko jawnej krawędzi w grafie. Maurycjusz i jego bezpośredni podwładni mogą pracować nad kompletnie różnymi tematami. W przestrzeni wektorowej ich dokumenty są daleko od siebie.

Trzeci, a zarazem najtrudniejszy typ to pytania globalne. „Jakie są główne tematy z ostatnich 100 spotkań?" „Podsumuj trendy w zgłoszeniach klientów z tego kwartału." Tu potrzebujesz czegoś, co widzi las, a nie poszczególne drzewa. Techniki takie jak GraphRAG od Microsoftu budują tzw. community summaries, czyli podsumowania klastrów powiązanych NC, które pozwalają odpowiedzieć na pytania o obraz całości.

W sierpniu 2024 roku zespoły Nvidia i BlackRock opublikowały paper Hybrid RAG, w którym formalnie opisały połączenie wyszukiwania wektorowego z grafami wiedzy. Testowały to na transkrypcjach rozmów inwestorskich z indyjskich spółek Nifty50 i wykazały, że kombinacja obu metod bije każdą z nich oddzielnie w takich metrykach jak Faithfulness, Relevance i Recall.

To ważne, ale zanim ktoś zacznie traktować Hybrid RAG jako nowy standard branżowy — to był prototyp badawczy, a nie system produkcyjny. Termin jest użyteczny jako nazwa wzorca, nie jest oficjalną nazwą czegokolwiek. Branża nie ustaliła konsensusu. Są zespoły, które hybrydowe podejście nazywają inaczej albo implementują zupełnie inne kombinacje — choćby Vector plus BM25, co jest formą Hybrid Searcha, niemającą niczego wspólnego z grafami. Trzeba to rozróżniać.

Ale wróćmy do naszego przykładu. Skoro wiemy, że potrzebujemy różnych strategii dla różnych typów zapytań, pojawia się pytanie, jak to zbudować, żeby nie zwariować.

Zacznijmy od tego, co wiele poradników przedstawia jako oczywisty wybór: PostgreSQL z rozszerzeniem PG Vector. Argument brzmi: masz już Postgresa, dodaj rozszerzenie, masz Vector Search w jednej bazie, ACID, 40 lat stabilności, koniec tematu. I dla wielu zastosowań to uczciwa rada. Jeżeli masz kilkaset tysięcy dokumentów, prostego RAG-a i nie planujesz skalować do milionów wektorów, PG Vector jest sensownym i dość pragmatycznym wyborem.

Ale twierdzenie, że PG Vector dominuje w 2025 czy 2026 — to już nieprawda. W listopadzie 2025 Alex Jacobs opublikował szczegółowy post mortem opisujący, jak PG Vector położył produkcyjną bazę danych. Scenariusz wygląda tak: w pierwszym miesiącu 10 tysięcy wektorów — wszystko działało szybko i przyjemnie. Po pół roku pół miliona — latencja rośnie, ale jest akceptowalna. Po roku pięć milionów — latencja staje się nieprzewidywalna, buildy indeksów HNSW trwają godzinami i zjadają ponad 10 giga RAM-u, produkcja wymaga restartów.

Problem jest architektoniczny. Postgres nie został zaprojektowany dla wektorów od samego początku. Dopisujesz vector search do bazy relacyjnej i przy skali wszystko zaczyna skrzypieć. Rozszerzenie PG Vector Scale od Timescale adresuje część tych problemów — dodaje Streaming Disk ANN, lepsze zarządzanie pamięcią — ale samo jego istnienie jest w sumie przyznaniem, że PG Vector out of the box nie wystarcza na produkcji.

Dedykowane bazy wektorowe, takie jak Qdrant, Milvus, Weaviate, rozwiązują problemy skali: natywny sharding, indeksy optymalizowane pod wektory, hybrid search łączący BM25 z embeddingami. Ale dodają złożoność operacyjną — to jest kolejny system do utrzymania, monitorowania i backupowania. Benchmarki z maja 2025 pokazują, że PG Vector Scale osiąga wyniki ponad 11 razy lepsze niż Qdrant w tym samym teście, ale powyżej 100 milionów wektorów dedykowane bazy przejmują prowadzenie.

Aktualny konsensus w 2026 to PolyStore: Postgres jako źródło prawdy dla danych relacyjnych, dedykowana baza wektorowa dla semantic searcha, opcjonalnie graf do zapytań o relacje. Nie jeden system do wszystkiego, tylko świadomy podział odpowiedzialności.

A co z grafami? GraphRAG od Microsoftu, a szerzej idea automatycznego budowania grafu wiedzy z LLM-ami, jest potężna, ale droga. Nie chodzi o cenę licencji, tylko o koszt budowy i utrzymania grafu. LLM musi przejść przez Twoje dokumenty, wyekstrahować encje i relacje, rozwiązać konflikty nazw, zbudować hierarchię. To są pipeline'y, które trzeba uruchamiać na bieżąco przy każdej znaczącej zmianie źródeł. Dla wielu zespołów to overkill. Dla tych, którzy potrzebują odpowiedzi na pytania o relacje i strukturę, to jedyna droga. Znów: zacznij od typów pytań, które Twój system musi obsłużyć, a nie od technologii, która może i wygląda imponująco — ale czy daje pożądany efekt i za jaką cenę?

Jest jeszcze jeden aspekt pamięci AI, o którym mówi się za mało. Skoro przechowujesz embeddingi dokumentów w bazie wektorowej, to przechowujesz semantyczne reprezentacje treści — i przez lata. Branża powtarzała, że embeddingi są bezpieczne, że to tylko wektory, z których nie da się odtworzyć oryginalnego tekstu. Ale to wierutna bzdura.

W 2023 roku John Morris wraz z zespołem opublikował Vec2Text — metodę, która odtwarza 92% oryginalnego tekstu z 32-tokenowych embeddingów. Jeszcze raz: 92% skuteczności. Wystarczająco, żeby odzyskać imiona, nazwiska, diagnozy medyczne z klinicznych notatek. Wcześniejsze prace Song i Raktunathana z 2020 roku odzyskiwały 50–70% słów, ale bez zachowania kolejności. Vec2Text robi to z pełną koherencją zdań.

I to nie jest martwy kierunek badawczy. W lutym 2025 pojawił się Algen — atak, który działa nawet bez dostępu do modelu osadzeń. Wystarczy jeden wycieknięty punkt danych, żeby wyrównać przestrzenie embeddingowe i zacząć inwersję. ZS-Invert z 2025 roku eliminuje potrzebę trenowania atakującego modelu w ogóle. Kierunek jest jasny: ataki stają się tańsze i łatwiejsze każdego roku.

Po pierwsze: nie udostępniaj surowych embeddingów. Jeżeli masz API, które zwraca wektory klientom, to jest wektor ataku. Zwracaj wyniki wyszukiwania, a nie same embeddingi.

Po drugie: access control na bazę wektorową. To brzmi jak oczywista oczywistość, ale w praktyce widzę systemy, w których baza wektorowa jest otwarta wewnętrznie — „bo to przecież tylko wektory". Nie: to semantyczne reprezentacje Twoich dokumentów i danych, z których można sporo wyciągnąć.

Po trzecie: szyfrowanie embeddingów. Rozwiązania takie jak Cloaked AI od Iron Core Labs stosują szyfrowanie wektorów, które zachowują wystarczające właściwości do wyszukiwania, ale inwersja zwraca nonsens. To relatywnie nowa kategoria narzędzi, ale warta obserwowania.

I tak zatoczyliśmy pełne kółeczko do scenariusza z początku. A że LLM-y lubią podsumowania nawet tak krótkich tekstów, to podsumujmy.

Osiem projektów zależy od API płatności. Wektor Search znalazł trzy. Jak to naprawić?

Opcja minimalna: wzbogacenie kontekstu dokumentów o metadane relacji. Nie budujesz pełnego grafu, zamiast tego dodajesz do każdego dokumentu sekcję „zależności" i „powiązane komponenty". To tani krok, który dramatycznie poprawia recall przy pytaniach o relacje, bo vector search zaczyna trafiać na frazy opisujące zależności.

Opcja kompromisowa: hybrid search, gdzie łączysz semantyczne wyszukiwanie wektorowe z keyword search (BM25). Teraz pytanie o API płatności trafia zarówno w semantycznie podobne dokumenty, jak i w te, które literalnie wspominają nazwę endpointu. Wiele baz, takich jak Weaviate, Qdrant, Elasticsearch, obsługuje to natywnie.

Opcja pełna to graf zależności między komponentami budowany automatycznie z dokumentacji technicznej przez LLM-a. Pytanie przechodzi przez intent routing, gdzie system decyduje, czy to pytanie o podobieństwo, o relacje, czy podsumowanie globalne, i kieruje je do odpowiedniego mechanizmu. Droższe, ale jedyne podejście, które skaluje się na pytania o złożone zależności w dużych systemach.

Żadna z tych opcji nie jest najlepsza. Każda jest najlepsza dla konkretnego kontekstu — czyli skali systemu, typów pytań, budżetu na utrzymanie infrastruktury. I to jest w gruncie rzeczy jedyny wniosek, z którym chcę was zostawić.

Pamięć AI nie jest problemem technologicznym, który rozwiązuje się jedną decyzją. To ciągły projekt inżynierski, który wymaga świadomego doboru narzędzi do konkretnych typów zapytań. Zaczynaj od pytań, a nie od narzędzi.
