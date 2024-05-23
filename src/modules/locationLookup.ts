import { getPref } from "../utils/prefs";

// TODOS
// - cleanup

// Alert-style debugging
// ztoolkit.getGlobal("alert")(LocationLookup.targetField);


export class LocationLookup {

    static itemWithoutISBN;
    static itemWithLocation;
    static itemWithoutLocation;

    static kurierbibliothekenUBBe = [
        "B400", //Speicher
        "B452", //FBB
        "B465", //JBB
        "B500", //vonRoll
        "B555", //BMi
        "B404", //BMü
        "B410", //BTO
        "B415", //SOB
        "B410", //Unitobler
    ];

    static libraryCodeUBBeOnline = "B405";

    // declare prefs
    static sruPrefix;
    static apiKey;
    static targetField;

    // Tags & Strings
    static noResultsInSwissbibBBText = "_UBE-Bestand: Keine Ergebnisse";
    static isWithoutISBNText = "_UBE-Bestand: ohne (gültige) ISBN";
    static isNotInUBBEText = '_UBE-Bestand: nein';
    static isInUBBeText = '_UBE-Bestand: ja';
    static isinUBBeKurierbibText = '_UBE-Bestand: Kurierbibliothek';
    static isInUBBeOnlineText = '_UBE-Bestand: Online';
    static isInUBBeOnlineViaEBAText = '_UBE-Bestand: Online via EBA';
    static idsbbBEpossibly = '_UBE-Bestand: eventuell';

    static tags = [this.isInUBBeOnlineText, this.isWithoutISBNText, this.isInUBBeText, this.isinUBBeKurierbibText, this.isNotInUBBEText, this.idsbbBEpossibly];

    static initialize() {
        LocationLookup.sruPrefix = getPref("sruurl");
        LocationLookup.apiKey = getPref("apikey");
        LocationLookup.targetField = getPref("targetField");
        LocationLookup.itemWithoutISBN = 0;
        LocationLookup.itemWithLocation = 0;
        LocationLookup.itemWithoutLocation = 0;
    };

    static isValidIsbn(isbn: string) {
        // ISBN überprüfen
        // Ist die Prüfziffer korrekt?
        // Korrekte Prüfziffer ist keine Garantie für korrekte ISBN, schliesst aber einige Fehlerquellen aus

        let lastDigit,
            currentDigit,
            checksum;

        // ISBN Rohdaten aufräumen: Alles weg ausser 0-9 und X;
        isbn = isbn.replace(/[^0-9X]/gi, '');
        // Ist die ISBN entweder 10 oder 13 Stellen lang? Falls nein => keine ISBN
        if (isbn.length != 10 && isbn.length != 13) {
            return false;
        }

        // Falls ja: letzte Ziffer holen
        lastDigit = isbn[isbn.length - 1].toUpperCase();

        // Prüfzimmern berechnen
        // siehe https://de.wikipedia.org/wiki/Internationale_Standardbuchnummer

        // ISBN-13
        if (isbn.length == 13) {
            let sum =
                (
                    parseInt(isbn[0]) + parseInt(isbn[2]) + parseInt(isbn[4]) +
                    parseInt(isbn[6]) + parseInt(isbn[8]) + parseInt(isbn[10])
                )
                + 3 *
                (
                    parseInt(isbn[1]) + parseInt(isbn[3]) + parseInt(isbn[5]) +
                    parseInt(isbn[7]) + parseInt(isbn[9]) + parseInt(isbn[11])
                );
            checksum = (10 - (sum % 10)) % 10;
        }

        // ISBN-10
        if (isbn.length == 10) {
            let multiplicator = [1, 2, 3, 4, 5, 6, 7, 8, 9];
            checksum =
                (
                    parseInt(isbn[0]) * multiplicator[0] +
                    parseInt(isbn[1]) * multiplicator[1] +
                    parseInt(isbn[2]) * multiplicator[2] +
                    parseInt(isbn[3]) * multiplicator[3] +
                    parseInt(isbn[4]) * multiplicator[4] +
                    parseInt(isbn[5]) * multiplicator[5] +
                    parseInt(isbn[6]) * multiplicator[6] +
                    parseInt(isbn[7]) * multiplicator[7] +
                    parseInt(isbn[8]) * multiplicator[8]
                ) % 11;
            // Statt Checksum 10 wird X verwendet
            if (checksum == 10) {
                checksum = 'X';
            }
        }

        // entspricht die letzte Ziffer der berechneten Prüfzimmer?
        return (checksum == lastDigit);
    }

    static applyTags(item, isInUBBe, isinUBBeKurierbib, isInUBBeOnline, isInUBBeOnlineViaEBA, isWithoutISBN) {
        // eventuell vorhandene alte Tags löschen
        for (const tag of LocationLookup.tags) {
            if (item.hasTag(tag)) {
                item.removeTag(tag);
            }
        }
        // neue Tags setzen
        // keine ISBN
        if (isWithoutISBN == true) {
            item.addTag(LocationLookup.isWithoutISBNText);
            LocationLookup.itemWithoutISBN++;
        }
        // kein Standort (aber ISBN)
        if ((isInUBBe == false) && (isWithoutISBN == false)) {
            item.addTag(LocationLookup.isNotInUBBEText);
            LocationLookup.itemWithoutLocation++;
        }
        // Standort an UB Bern
        if (isInUBBe == true) {
            item.addTag(LocationLookup.isInUBBeText);
            LocationLookup.itemWithLocation++;
        }
        // In UB Bern Kurierbibliothek
        if (isinUBBeKurierbib == true) {
            item.addTag(LocationLookup.isinUBBeKurierbibText);
            LocationLookup.itemWithLocation++;
        }
        // An UB Bern Online verfügbar
        if (isInUBBeOnline == true) {
            item.addTag(LocationLookup.isInUBBeOnlineText);
        }
        // An UB Bern Online via EBA
        if (isInUBBeOnlineViaEBA == true) {
            item.addTag(LocationLookup.isInUBBeOnlineViaEBAText);
        }
        // if (status == "eventuell") {
        //     item.addTag(idsbbBEpossibleText);
        //}
    }

    // static printResults() {
    //     let results = items.length + " Einträge verarbeitet\n" + LocationLookup.itemWithLocation + " Einträge mit Standort an UB Bern\n" + LocationLookup.itemWithoutLocation + " Einträge ohne Standort an UB Bern\n" + LocationLookup.itemWithoutISBN + " Einträge ohne ISBN";
    //     alert(results);
    // }

    static async getItemPolicy(BibRecordID, HoldingID) {
        // https://api-eu.hosted.exlibrisgroup.com/almaws/v1/bibs/99116716250105511/holdings/22163616910005511/items?format=json&apikey=
        let url = "https://api-eu.hosted.exlibrisgroup.com/almaws/v1/bibs/" + BibRecordID + "/holdings/" + HoldingID + "/items?format=json&apikey=" + LocationLookup.apiKey;
        let response = await fetch(url);
        let parsed = await response.json();
        let policy;
        if (parsed.item === undefined) {
            policy = "Leihbedingungen nicht verfügbar";
        } else {
            policy = await parsed.item[0].item_data.policy.desc;
        }
        return policy;
    }

    static async processXML(item, xml) {
        // Schalter setzen
        let isInUBBe = false;
        let isInUBBeOnline = false;
        let isInUBBeOnlineViaEBA = false;
        let isinUBBeKurierbib = false;
        let isWithoutISBN = false;
        // Formatierung der Ergebnisse
        let date = new Date();
        let thisMonth = date.getMonth() + 1;
        let currentDate = date.getFullYear() + "-" + thisMonth + "-" + date.getDate() + " (" + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds() + ")";
        let holdingsFormatted = currentDate + " Bestand Swisscovery UB Bern\n=======================================";
        //let printHoldingsFormatted = "\n\n" + "Print-Bestände\n----------------------------------";
        //let eHoldingsFormatted = "\n\n" + "Elektronische Bestände\n----------------------------------";
        let printHoldingsFormatted = "";
        let eHoldingsFormatted = "";
        let xmlResponse = xml.responseXML;
        // Haben wir Ergebnisse in Swissbib BB?
        // Nein =>
        if (xmlResponse.querySelector("searchRetrieveResponse > numberOfRecords").textContent == "0") {
            holdingsFormatted += ("\n" + LocationLookup.noResultsInSwissbibBBText);
            // Ja =>
        } else {
            if (xmlResponse.querySelector("datafield[tag='AVE']")) {
                let eholdings = xmlResponse.querySelectorAll("datafield[tag='AVE']");
                for (const eholding of eholdings) {
                    let eholdingAvailability = (eholding.querySelector("subfield[code='e']").textContent == "Available") ? "Online verfügbar" : "Online nicht verfügbar";
                    let eholdingZones = eholding.querySelectorAll("subfield[code='b']");
                    let eholdingPackage = (eholding.querySelector("subfield[code='m']")) ? ", " + eholding.querySelector("subfield[code='m']").textContent : ", kein Paketkauf"
                    let eholdingZonesString = "";
                    for (const zone of eholdingZones) {
                        eholdingZonesString = eholdingZonesString + ", " + zone.textContent;
                    }
                    let eHoldingFormatted = `\n${eholdingAvailability}${eholdingZonesString}${eholdingPackage}`;
                    eHoldingsFormatted += eHoldingFormatted;
                    if (eholdingAvailability == "Online verfügbar") {
                        if (!eholdingPackage.includes('TEMP')) {
                            isInUBBeOnline = true;
                            isInUBBe = true;
                        } else {
                            isInUBBeOnlineViaEBA = true;
                        }

                    }

                    // TODO Tags setzen

                    //TODO 2: EBAs verarbeitung
                    // So müsste es gehen: eholdingPackage.includes('EBA')
                    /* let example = "Example String!";
                    let ourSubstring = "Example";
    
                    if (example.includes(ourSubstring)) {
                        console.log("The word Example is in the string.");
                    } else {
                        console.log("The word Example is not in the string.");
                    }*/
                }
            }
            else {
                eHoldingsFormatted += "\nKeine elektronischen Bestände vorhanden";
            }
            if (xmlResponse.querySelector("datafield[tag='AVA']")) {
                let holdings = xmlResponse.querySelectorAll("datafield[tag='AVA']");
                for (const holding of holdings) {
                    let holdingLibraryCode,
                        holdingLibrary,
                        holdingLibraryViaRapido,
                        holdingLibraryLocation,
                        holdingFormatted,
                        holdingItemPolicy,
                        holdingHoldingsID, // subfield 8
                        holdingBibRecordID; // subfield 0
                    //
                    holdingLibraryCode = holding.querySelector("subfield[code='b']").textContent;
                    if (holding.querySelector("subfield[code='q']")) {
                        holdingLibrary = holding.querySelector("subfield[code='q']").textContent;
                    } else {
                        if (holdingLibraryCode == "B405") {
                            holdingLibrary = "Bern UB Online";
                        } else if (holdingLibraryCode == "A145") {
                            holdingLibrary = "Basel Online";
                        } else {
                            holdingLibrary = holdingLibraryCode;
                        }
                    }
                    if (holding.querySelector("subfield[code='j']"))
                        holdingLibraryViaRapido = holding.querySelector("subfield[code='j']").textContent == "RS_BORROW";
                    if (holding.querySelector("subfield[code='c']"))
                        holdingLibraryLocation = holding.querySelector("subfield[code='c']").textContent;
                    if (holdingLibraryLocation.startsWith('Borrowing Location')) holdingLibraryLocation += " (via Rapido)";
                    if (holding.querySelector("subfield[code='0']"))
                        holdingBibRecordID = holding.querySelector("subfield[code='0']").textContent;
                    if (holding.querySelector("subfield[code='8']"))
                        holdingHoldingsID = holding.querySelector("subfield[code='8']").textContent;
                    //
                    if (LocationLookup.apiKey != "") holdingItemPolicy = await LocationLookup.getItemPolicy(holdingBibRecordID, holdingHoldingsID)
                    // hier haben wir ein Problem mit dem Scoping der Variablen...
                    // wie bekomme ich die Variable holdingFormatted nach aussen?
                    holdingFormatted = "\n" + holdingLibrary;
                    if (holdingLibraryLocation) holdingFormatted = holdingFormatted + ", " + holdingLibraryLocation;
                    if (holdingItemPolicy) holdingFormatted = holdingFormatted + ", " + holdingItemPolicy
                    // Aktuelles Holding zur Holdingliste hinzufügen
                    printHoldingsFormatted += holdingFormatted;

                    // In UB Bern?
                    // Irgendwo in UB Bern oder Bern Online
                    if ((holdingLibrary.startsWith("Bern UB") && !(holdingLibraryViaRapido)) || (holdingLibrary == "B405")) isInUBBe = true;
                    // Kurierbibliothek
                    if (LocationLookup.kurierbibliothekenUBBe.includes(holdingLibraryCode) && !(holdingLibraryViaRapido)) isinUBBeKurierbib = true;
                }
            }
            else {
                printHoldingsFormatted += "\nKeine Printbestände vorhanden";
            }
            holdingsFormatted = holdingsFormatted + printHoldingsFormatted + eHoldingsFormatted;
        }

        // Tags setzen
        LocationLookup.applyTags(item, isInUBBe, isinUBBeKurierbib, isInUBBeOnline, isInUBBeOnlineViaEBA, isWithoutISBN);

        // Holdings speichern
        // Im Feld Zusammenfassung
        let oldAbstractNote = item.getField(LocationLookup.targetField);
        item.setField(LocationLookup.targetField, holdingsFormatted + "\n============================\n\n" + oldAbstractNote);
        // Oder in Notiz?
        // var note = new Zotero.Item('note');
        // note.setNote(holdingsFormatted);
        // ??? VAR1 note.parentKey = item.key;
        // ??? ODER note.parentID = item.id;
        // note.saveTx();
    }

    static async updateLocations(item, holdings) {
        let oldAbstractNote = item.getField(LocationLookup.targetField);
        item.setField(LocationLookup.targetField, holdings + "\n============================\n\n" + oldAbstractNote);
    }

    // Main Function
    static async lookup() {
        LocationLookup.initialize();
        // Zuerst holen wir die aktuell ausgewählten Titel
        let ZoteroPane = Zotero.getActiveZoteroPane();
        let selectedItems = ZoteroPane.getSelectedItems();

        // Alle nicht-Buch-Titel werden herausgefiltert
        let items = selectedItems.filter(item => item.itemTypeID == Zotero.ItemTypes.getID('book'));
        // Loop durch die Items
        for (const item of items) {
            let isbns;
            if (item.getField('ISBN')) {
                isbns = String(item.getField('ISBN')).split(" ");
            }
            if (!(item.getField('ISBN')) || !(isbns.some(LocationLookup.isValidIsbn) == true)) {
                // Keine (oder keine gültige) ISBN vorhanden
                let isInUBBe = false;
                let isInUBBeOnline = false;
                let isInUBBeOnlineViaEBA = false;
                let isinUBBeKurierbib = false;
                let isWithoutISBN = true;
                LocationLookup.applyTags(item, isInUBBe, isinUBBeKurierbib, isInUBBeOnline, isInUBBeOnlineViaEBA, isWithoutISBN);
                await item.saveTx();
            } else {
                // Mindestens eine gültige ISBN vorhanden
                // SRU-Request
                // URL-Konstruktion ist hässlich; man kann die isbns sicherlich besser verbinden;
                // für den Moment ok
                let URL = LocationLookup.sruPrefix + isbns.join(" or alma.isbn=");
                let sru = new XMLHttpRequest();
                sru.onreadystatechange = async function () {
                    if (this.readyState == 4 && this.status == 200) {
                        /* let results;
                        results = await Zotero.swisscoveryubbernlocations.processXML2(this);
                        results.then((x) => {
                            Zotero.swisscoveryubbernlocations.updateLocations(item,x);
                        }); */
                        await LocationLookup.processXML(item, this)
                        await item.saveTx();
                    };
                };
                sru.open("GET", URL, true);
                sru.send();
            }
        };
    };
}

