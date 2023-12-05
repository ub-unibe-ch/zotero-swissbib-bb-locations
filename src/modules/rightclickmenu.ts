import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { OrderNote } from "./orderNote";
import { LocationLookup } from "./locationLookup";

export class RightClickMenu {

  static registerRightClickMenuPopup() {
    ztoolkit.Menu.register(
      "item",
      {
        tag: "menu",
        label: getString("menuitem-submenu-label"),
        children: [
          {
            tag: "menuitem",
            label: getString("menuitem-location-lookup"),
            commandListener: () => LocationLookup.lookup(),
          },
          {
            tag: "menuitem",
            label: getString("menuitem-ordernotesfromtags"),
            commandListener: () => OrderNote.add(),
          },
        ],
      },
    );
  }
}