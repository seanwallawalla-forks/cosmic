const { Gio } = imports.gi;
const { AppDisplay } = imports.ui.appDisplay;
const { ExtensionState } = imports.misc.extensionUtils;
const Main = imports.ui.main;
const { ModalDialog, State } = imports.ui.modalDialog;
const { RemoteSearchProvider2 } = imports.ui.remoteSearch;

let dialog = null;
let button_press_id = null;
let shop_provider = null;

function enable() {
    dialog = new ModalDialog({destroyOnClose: false, shellReactive: true});
    dialog.dialogLayout._dialog.style = "background-color: #36322f;";
    dialog.connect("key-press-event", (_, event) => {
        if (event.get_key_symbol() == 65307)
            hide();
    });

    button_press_id = global.stage.connect('button-press-event', () => {
        const [ width, height ] = dialog.dialogLayout._dialog.get_transformed_size();
        const [ x, y ] = dialog.dialogLayout._dialog.get_transformed_position();
        const [ cursor_x, cursor_y ] = global.get_pointer();

        if (dialog.visible && (cursor_x < x || cursor_x > x + width || cursor_y < y || cursor_y > y + height))
            hide();
    });

    const app_display = new AppDisplay();
    app_display.set_size(1000, 1000); // XXX
    dialog.contentLayout.add(app_display);

    const appInfo = Gio.DesktopAppInfo.new("io.elementary.appcenter.desktop");
    const busName = "io.elementary.appcenter";
    const objectPath = "/io/elementary/appcenter/SearchProvider";
    if (appInfo) {
        const provider = new RemoteSearchProvider2(appInfo, busName, objectPath, true);
    }
}

function disable() {
    shop_provider = null;

    global.stage.disconnect(button_press_id);
    button_press_id = null;

    dialog.destroy();
    dialog = null;
}

function visible() {
    return dialog.state == State.OPENED || dialog.state == State.OPENING;
}

function show() {
    dialog.open();
}

function hide() {
    dialog.close();

    const cosmicDock = Main.extensionManager.lookup("cosmic-dock@system76.com");
    if (cosmicDock && cosmicDock.state === ExtensionState.ENABLED) {
        cosmicDock.stateObj.dockManager._allDocks.forEach((dock) => dock._onOverviewHiding());
    }
}
