# 10. Mesterséges intelligencia használata a fejlesztés során

Az InstaCover fejlesztése során a mesterséges intelligenciát nem alkalmi segédeszközként, hanem a napi fejlesztési munkafolyamat szerves részeként használtam. A célom nem az volt, hogy a rendszer helyettem hozzon mérnöki döntéseket, hanem az, hogy felgyorsítsa a megvalósítást azokban a feladatokban, ahol a probléma már kellően pontosan definiálható volt. A fejlesztési folyamatban az MI leginkább tervezési partnerként, kódelőállító eszközként és gyors iterációt támogató asszisztensként működött.

## 10.1. Felhasznált eszközök

A fejlesztés során három modellt használtam rendszeresen: a Claude Sonnet 4.6-ot, a Claude Opus 4.6-ot és a GPT-5.5-öt. Ezeket minden esetben az OpenCode CLI-n keresztül értem el, vagyis a fejlesztési munkafolyamaton belül, közvetlenül a kódbázis kontextusában dolgoztam velük. A különböző modelleket nem élesen elkülönített szerepekben használtam, hanem attól függően váltottam köztük, hogy egy adott feladatnál melyik adott jobb tervet, pontosabb kódot vagy használhatóbb javaslatot.

A fejlesztéshez kapcsolódó kutatási és tájékozódási feladatoknál a Perplexityt is használtam. Ezt nem közvetlen kódgenerálásra vetettem be, hanem általános keresésekre, technikák összehasonlítására, dokumentációk gyors feltárására és egy-egy megoldási irány előzetes felmérésére. Fejlesztési célra ezen kívül más MI-eszközt nem alkalmaztam.

## 10.2. Felhasználási területek

Az MI használata a projektben elsősorban kódgenerálásra épült. A fejlesztés során a kód jelentős részének első változatát MI segítségével állítottam elő. Ez különösen igaz volt a backend route-ok, szolgáltatási rétegek, validációs logikák, segédfüggvények és a Supabase-hez kapcsolódó SQL lekérdezések, illetve RPC-függvények megírására. A Supabase SQL-réteg kialakításában kifejezetten sokat támaszkodtam az MI-re, mert ezen a területen gyorsan tudott olyan induló megoldásokat adni, amelyeket ezután a saját igényeimhez igazítottam.

Az automatizált tesztelés területén még hangsúlyosabb volt a szerepe. A pytest-alapú tesztkészlet első verzióit gyakorlatilag teljes egészében MI-vel generáltattam. Ez nem azt jelentette, hogy a teszteket változtatás nélkül vettem át, hanem azt, hogy a tesztvázak, a fixture-ök, a tipikus happy path és hibakezelési esetek nagy részét az MI készítette el, én pedig ezeket felülvizsgáltam, pontosítottam és a projekt saját viselkedéséhez igazítottam.

Az MI-t emellett tervezési előkészítésre is használtam. A tipikus munkamenetem az volt, hogy először leírtam, mit szeretnék funkcionálisan elérni, milyen kényszerekkel és milyen architekturális elvárásokkal. Erre az MI általában egy implementációs tervvel vagy részletes megoldási javaslattal válaszolt. Ezt a tervet ritkán fogadtam el elsőre: pontosítottam a határokat, szűkítettem a feladatot, tisztáztam az adatfolyamot vagy a kívánt viselkedést, majd csak ezután generáltattam le a konkrét kódot. A rendszer tehát nem önálló tervezőként működött, hanem olyan eszközként, amely gyorsan reagált a fokozatosan pontosított specifikációra.

## 10.3. Validáció és kritikus szemlélet

Az MI kimenetét a fejlesztés során nem kész megoldásként, hanem kiindulási javaslatként kezeltem. A legfontosabb ellenőrzési mechanizmusom az volt, hogy a kívánt működést először én határoztam meg, és csak ezután kértem implementációt. A gyakorlatban ez azt jelentette, hogy a fejlesztési ciklus több lépésből állt: cél meghatározása, az MI által javasolt terv átnézése, a terv pontosítása, a kód generálása, végül manuális és automatizált ellenőrzés. Ez a folyamat különösen fontos volt azért, mert a modellek sokszor technikailag plauzibilis, de szemléletében vagy rendszerillesztésében nem megfelelő megoldást adtak.

Többször előfordult, hogy az MI által generált kód nem azért volt problémás, mert szintaktikailag hibás lett volna, hanem mert nem azt az architekturális vagy üzleti logikát valósította meg, amit én szerettem volna. Ennek tipikus példája a Supabase SQL-réteg volt: az MI gyakran gyorsan előállított egy látszólag korrekt lekérdezést vagy RPC-függvényt, de a lekérdezés szűrése, visszatérési szerkezete vagy a projekt többi részéhez való illeszkedése módosítást igényelt. Ilyenkor nem újragondolás nélkül fogadtam el a javaslatot, hanem addig pontosítottam a követelményeket, amíg a generált megoldás a kívánt működést nem követte.

Hasonló tapasztalatom volt a tesztekkel is. Az MI nagyon gyorsan tudott nagy mennyiségű tesztkódot előállítani, de ezek első változatban gyakran túlzottan a tipikus sikeres lefutásokra koncentráltak. Nekem kellett eldöntenem, hogy melyek azok a hibás bemenetek, szélső esetek és jogosultsági helyzetek, amelyeket valóban le kell fedni. A validációt ezért nem pusztán a generált szöveg vagy kód minősége jelentette, hanem az, hogy a végeredmény megfelelt-e a saját elképzelésemnek, jól illeszkedett-e a meglévő rendszerbe, és a tényleges tesztelés során is helyesnek bizonyult-e.

## 10.4. Ahol nem használtam MI-t

Tudatosan nem bíztam az MI-re az alapvető architekturális és technológiai döntéseket. A fő rendszerfelépítés, a frontend-backend felosztás, a valós idejű kommunikáció módja, a Supabase használata, a kreditrendszer helye a rendszerben, valamint a projekt általános technológiai iránya a saját döntéseim eredménye volt. Az MI ezen a ponton legfeljebb alternatívákat vagy ellenőrző szempontokat tudott adni, de a végső döntést minden esetben én hoztam meg.

Nem használtam MI-t a technikák tényleges kipróbálására és ellenőrzésére sem. Az, hogy egy adott megközelítés a projektben valóban működik-e, milyen korlátai vannak, hogyan viselkedik integrált környezetben, és megfelel-e az elvárt felhasználói élménynek, minden esetben saját teszteléssel dőlt el. Ugyanez igaz volt azokra a helyzetekre is, amikor a rendszer viselkedésének végső formáját kellett meghatároznom: az MI tudott javaslatot tenni, de azt, hogy pontosan mit és hogyan szeretnék a programban megvalósítani, nekem kellett definiálnom.

Szintén nem engedtem át az MI-nek a projekt határainak kijelölését. A feladatok priorizálása, a funkciók szűkítése, az implementációk végső egyszerűsítése, valamint annak eldöntése, hogy egy adott megoldás túl bonyolult-e a projekt céljaihoz képest, mérnöki döntés maradt. Ezekben a helyzetekben az MI sokszor inkább a túltermelés irányába vitte volna a megoldást, nekem kellett visszahozni a rendszert egy kezelhető, fenntartható formába.

## 10.5. Tanulságok

A projekt legfontosabb tanulsága számomra az volt, hogy az MI a legnagyobb értéket akkor adja, ha a probléma már kellően pontosan meg van fogalmazva. Ilyenkor kifejezetten nagy gyorsulást jelent: rövid idő alatt képes nagy mennyiségű kódot, SQL-t vagy tesztet előállítani, és jelentősen csökkenti a repetitív munka mennyiségét. Ez különösen igaz volt a tesztkészlet bővítésére, a Supabase SQL-réteg kialakítására és az ismétlődő backend logikák első implementációjára.

Ezzel szemben azt is megtanultam, hogy az MI gyenge pontja nem feltétlenül a szintaxis, hanem a szándék pontos követése. Sok esetben nem hibás, hanem „majdnem jó" megoldást adott: olyat, amely első olvasásra meggyőzőnek tűnt, de nem pontosan azt valósította meg, amit a projekt logikája vagy az én szemléletem megkívánt. Emiatt a sikeres használat kulcsa nem pusztán a jó prompt, hanem a fokozatos pontosítás, a szűk feladatokra bontás és a következetes ellenőrzés volt.

A folyamat összességében megerősítette bennem, hogy a mesterséges intelligencia fejlesztési környezetben rendkívül hatékony gyorsítóeszköz, de nem helyettesíti a mérnöki felelősséget. A következő hasonló projektben még tudatosabban bontanám kisebb egységekre a feladatokat, és még korábban rögzíteném az elfogadási feltételeket, mielőtt kódot generáltatnék. Minél pontosabban tudtam meghatározni a kívánt működést, annál hasznosabb volt az MI; ahol viszont a cél homályos maradt, ott a generált kód is nagyobb utólagos korrekciót igényelt.
