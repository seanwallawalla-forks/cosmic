const { AppDisplay } = imports.ui.appDisplay;
const { ExtensionState } = imports.misc.extensionUtils;
const Main = imports.ui.main;
const { ModalDialog, State } = imports.ui.modalDialog;

// XXX create on enable
const dialog = new ModalDialog({destroyOnClose: false, shellReactive: true});
dialog.dialogLayout._dialog.style = "background-color: #36322f;";
dialog.connect("key-press-event", (_, event) => {
    if (event.get_key_symbol() == 65307)
        hide();
});

const app_display = new AppDisplay();
app_display.set_size(1000, 1000); // XXX
dialog.contentLayout.add(app_display);

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
