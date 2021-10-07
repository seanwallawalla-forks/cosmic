const { Clutter, Gio, GObject, Shell, St } = imports.gi;
const { AppDisplay, AppSearchProvider } = imports.ui.appDisplay;
const { ExtensionState } = imports.misc.extensionUtils;
const Main = imports.ui.main;
const { ModalDialog, State } = imports.ui.modalDialog;
const OverviewControls = imports.ui.overviewControls;
const { RemoteSearchProvider2 } = imports.ui.remoteSearch;
const Search = imports.ui.search;
const { getTermsForSearchString } = imports.ui.searchController;

let dialog = null;
let button_press_id = null;
let searchEntry = null;
let appDisplay = null;
let resultsView = null;
let inSearch = false;

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

        this._cancellable = new Gio.Cancellable();

        this._providers = [];
        this._terms = [];

        const provider = new AppSearchProvider();
        //const providerDisplay = new Search.ListSearchResults(provider, this);
        const providerDisplay = new Search.GridSearchResults(provider, this);
        this._content.add(providerDisplay)
        provider.display = providerDisplay;
        this._providers.push(provider);

        const appInfo = Gio.DesktopAppInfo.new("io.elementary.appcenter.desktop");
        const busName = "io.elementary.appcenter";
        const objectPath = "/io/elementary/appcenter/SearchProvider";
        if (appInfo) {
            const provider = new RemoteSearchProvider2(appInfo, busName, objectPath, true);
            const providerDisplay = new Search.ListSearchResults(provider, this);
            this._content.add(providerDisplay)
            provider.display = providerDisplay;
            this._providers.push(provider);
        }
    }

    get terms() {
        return this._terms;
    }

    setTerms(terms) {
        // TODO
        this._terms = terms;
        this.emit('terms-changed');

        this._cancellable.cancel();
        this._cancellable.reset();

        // TODO timer

        this._providers.forEach(provider => {
            provider.searchInProgress = true;
        
            //let previousProviderResults = previousResults[provider.id];
            //if (this._isSubSearch && previousProviderResults) {
            if (false) { // XXX
                provider.getSubsearchResultSet(previousProviderResults,
                                               this._terms,    
                                               results => {
                                                   this._gotResults(results, provider);
                                               },
                                               this._cancellable);
            } else {
                provider.getInitialResultSet(this._terms,
                                             results => {
                                                 this._gotResults(results, provider);
                                             },
                                             this._cancellable);
            }
        });
    }

    _gotResults(results, provider) {
        const display = provider.display;

        const terms = this._terms;
                                                 
        display.updateSearch(results, terms, () => {
            provider.searchInProgress = false;
            
            // XXX
        });
        global.log(results);
        // TODO
    }

    highlightTerms(description) {
        return ""; // TODO
    }
});

function fadeSearch(newInSearch) {
    if (newInSearch == inSearch)
        return;

    inSearch = newInSearch;

    let oldPage, newPage;
    if (inSearch)
        [oldPage, newPage] = [appDisplay, resultsView];
    else
        [oldPage, newPage] = [resultsView, appDisplay];

    oldPage.ease({
        opacity: 0,
        duration: OverviewControls.SIDE_CONTROLS_ANIMATION_TIME,
        mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        //onStopped: () => this._animateIn(oldPage),
    });

    newPage.ease({
        opacity: 255,
        duration: OverviewControls.SIDE_CONTROLS_ANIMATION_TIME,
        mode: Clutter.AnimationMode.EASE_OUT_QUAD,
    });
}

function enable() {
    searchEntry = new St.Entry({
        style_class: 'search-entry',
        hint_text: _('Type to search'),
        track_hover: true,
        can_focus: true,
    });

    appDisplay = new AppDisplay();
    appDisplay.set_size(1000, 1000); // XXX

    resultsView = new CosmicSearchResultsView();
    resultsView.opacity = 0;

    searchEntry.clutter_text.connect('text-changed', () => {
        const terms = getTermsForSearchString(searchEntry.get_text());
        resultsView.setTerms(terms);

        fadeSearch(searchEntry.get_text() !== '');
    });

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
    searchEntry = null;
    appDisplay = null;
    resultsView = null;

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
    searchEntry.grab_key_focus();
}

function hide() {
    dialog.close();

    const cosmicDock = Main.extensionManager.lookup("cosmic-dock@system76.com");
    if (cosmicDock && cosmicDock.state === ExtensionState.ENABLED) {
        cosmicDock.stateObj.dockManager._allDocks.forEach((dock) => dock._onOverviewHiding());
    }
}
