const { Clutter, Gio, GObject, Shell, St } = imports.gi;
const { AppDisplay, AppSearchProvider } = imports.ui.appDisplay;
const { ExtensionState } = imports.misc.extensionUtils;
const Main = imports.ui.main;
const { ModalDialog, State } = imports.ui.modalDialog;
const OverviewControls = imports.ui.overviewControls;
const { RemoteSearchProvider2 } = imports.ui.remoteSearch;
const Search = imports.ui.search;

let dialog = null;
let button_press_id = null;
let shop_provider = null;

var CosmicSearchResultsView = GObject.registerClass({
    Signals: { 'terms-changed': {} },
}, class CosmicSearchResultsView extends St.BoxLayout {
    _init() {
	super._init();
        this._content = new Search.MaxWidthBox({
            name: 'searchResultsContent',
            vertical: true,
            x_expand: true,
        });
        this.add_actor(this._content);
        // TODO: scroll

        const appInfo = Gio.DesktopAppInfo.new("io.elementary.appcenter.desktop");
        const busName = "io.elementary.appcenter";
        const objectPath = "/io/elementary/appcenter/SearchProvider";
        if (appInfo) {
            const provider = new RemoteSearchProvider2(appInfo, busName, objectPath, true);
            const providerDisplay = new Search.ListSearchResults(provider, this);
            this._content.add(providerDisplay)
            provider.display = providerDisplay;
        }

        const provider = new AppSearchProvider();
        //const providerDisplay = new Search.ListSearchResults(provider, this);
        const providerDisplay = new Search.GridSearchResults(provider, this);
        this._content.add(providerDisplay)
        provider.display = providerDisplay;

        this.emit('terms-changed'); // XXX
    }
    get terms() {
        return ["chrome"]; // XXX
    }
});

/*
        this._activePage.ease({
            opacity: 255,
            duration: OverviewControls.SIDE_CONTROLS_ANIMATION_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
    }

    _fadePageOut(page) {
        let oldPage = page;
        page.ease({
            opacity: 0,
            duration: OverviewControls.SIDE_CONTROLS_ANIMATION_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onStopped: () => this._animateIn(oldPage),
        });
    }
*/

function enable() {
    const searchEntry = new St.Entry({
        style_class: 'search-entry',
        hint_text: _('Type to search'),
        track_hover: true,
        can_focus: true,
    });

    const appDisplay = new AppDisplay();
    appDisplay.set_size(1000, 1000); // XXX

    const resultsView = new CosmicSearchResultsView();

    const stack = new Shell.Stack({});
    stack.add_child(appDisplay);
    stack.add_child(resultsView);

    const box = new St.BoxLayout({ vertical: true });
    box.add_child(searchEntry);
    box.add_child(stack);

    dialog = new ModalDialog({destroyOnClose: false, shellReactive: true});
    dialog.contentLayout.add(box);
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
