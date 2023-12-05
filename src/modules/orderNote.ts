export class OrderNote {

    static async add() {
        // Zuerst holen wir die aktuell ausgewählten Titel
        let ZoteroPane = Zotero.getActiveZoteroPane();
        let selectedItems = ZoteroPane.getSelectedItems();
        // Alle nicht-Buch-Titel werden herausgefiltert
        let items = selectedItems.filter(item => item.itemTypeID == Zotero.ItemTypes.getID('book'));
        // Loop durch die Items
        for (const item of items) {
            let tags = item.getTags();
            // initialize vars
            let ddcs: string[] = [];
            let orderCodes: string[] = [];
            let budgetCode = "";
            // iterate over tags
            for (let tag of tags) {
                if (tag.tag.startsWith("DDC")) {
                    // tag is a DDC
                    let tagText = tag.tag.replace(/[^0-9X]/gi, '');
                    ddcs.push(tagText)
                }
                else if (tag.tag.startsWith("BC")) {
                    // tag is an orderCode
                    let orderCodeText = tag.tag.substring(3);
                    orderCodes.push(orderCodeText);
                }
                else if (tag.tag.startsWith("ETAT")) {
                    // tag is an budgetCode
                    budgetCode = tag.tag.substring(5);
                }
            }
            // construct orderNote
            let orderNote: string[] = [];
            orderNote.push(budgetCode);
            orderNote.push(ddcs.join(', '));
            orderNote.push(orderCodes.join(', ')); // maybe better use a semicolon?
            orderNote = orderNote.filter(Boolean);
            // update volume field and save item
            item.setField('volume', orderNote.join(' // '));
            await item.saveTx();
        };
    }
}