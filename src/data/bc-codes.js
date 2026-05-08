module.exports = {
  allowFreeText: true,
  groups: [
    {
      label: "Print / Verfügbarkeit",
      entries: [
        { code: "MEX",  label: "Auch wenn eBook oder Print in Kurierbibl. vorhanden" },
        { code: "MEXo", label: "Auch wenn eBook vorhanden" },
        { code: "MEXp", label: "Auch wenn Print in Kurierbibl. vorhanden" },
        { code: "UBE",  label: "Nur wenn nirgends in UB Bern vorhanden" },
        { code: "SLSP", label: "Nur wenn schweizweit in keiner SLSP-Bibl. ausleihbar" },
      ],
    },
    {
      label: "E-Book",
      entries: [
        { code: "E1",   label: "1-user" },
        { code: "E1p",  label: "1-user, auch wenn Print vorhanden" },
        { code: "E1s",  label: "1-user + NZ-Katalogisat" },
        { code: "E1ps", label: "1-user, auch wenn Print + NZ-Katalogisat" },
        { code: "E3",   label: "3-user" },
        { code: "E3p",  label: "3-user, auch wenn Print vorhanden" },
        { code: "E3s",  label: "3-user + NZ-Katalogisat" },
        { code: "E3ps", label: "3-user, auch wenn Print + NZ-Katalogisat" },
        { code: "E+",   label: "Unlimited" },
        { code: "E+p",  label: "Unlimited, auch wenn Print vorhanden" },
        { code: "E+s",  label: "Unlimited + NZ-Katalogisat" },
        { code: "E+ps", label: "Unlimited, auch wenn Print + NZ-Katalogisat" },
        { code: "OA",   label: "OA-Katalogisat erstellen (keine Erwerbung)" },
      ],
    },
    {
      label: "Bernensia",
      entries: [
        { code: "Ausleihe",                label: "1 Exemplar: Ausleihe (UB-Speicher)" },
        { code: "Ausleihe+Archiv",         label: "2 Exemplare: Ausleihe + Archiv (BMü-Sonderlesesaal)" },
        { code: "Ausleihe+Archiv+Ansicht", label: "3 Exemplare: Ausleihe + Archiv + Ansicht (Bernensia-Bibl.)" },
        { code: "bb",                      label: "Berner Belletristik" },
      ],
    },
  ],
};
