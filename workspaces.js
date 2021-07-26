const { Clutter, GLib, GObject, Meta, Shell, St } = imports.gi;
const Background = imports.ui.background;
const Main = imports.ui.main;
const LayoutManager = imports.ui.layout;
const ViewSelector = imports.ui.viewSelector;
const WorkspaceThumbnail = imports.ui.workspaceThumbnail;
const OverviewControls = imports.ui.overviewControls;
const Overview = imports.ui.overview;
const Dash = imports.ui.dash;
var { ControlsLayout, DashSlider, DashSpacer, ThumbnailsSlider } = imports.ui.overviewControls;
var { ThumbnailState } = imports.ui.workspaceThumbnail;
var { ShellInfo } = imports.ui.overview;

class OverviewMonitor extends Overview.Overview {
    constructor(monitorIndex) {
        super();
        this._monitorIndex = monitorIndex;
        this.init();
    }

    init() {
        this._initCalled = true;

        if (this.isDummy)
            return;

        //this._overview = new OverviewActor();
        this._overview = new OverviewActorMonitor(this._monitorIndex);
        this._overview._delegate = this;
        Main.layoutManager.overviewGroup.add_child(this._overview);
        this._overview.connect('notify::allocation', () => this.emit('relayout'));

        this._shellInfo = new ShellInfo();

        this._monitorsChangedId = Main.layoutManager.connect('monitors-changed', this._relayout.bind(this));
        this._relayout();

        this._overview.connect('destroy', this._onDestroy.bind(this));

        // XXX
        //this._showingId = Main.overview.connect('showing', this.show.bind(this));
        //this._hidingId = Main.overview.connect('hiding', this.hide.bind(this));
    }

    _onDestroy() {
        Main.layoutManager.disconnect(this._monitorsChangedId);
    }

    _updateBackgrounds() {
    }
}

var OverviewActorMonitor = GObject.registerClass(
class OverviewActorMonitor extends St.BoxLayout {
    _init(monitorIndex) {
        super._init({
            vertical: true,
        });

        this.add_constraint(new LayoutManager.MonitorConstraint({ index: monitorIndex }));

        //this._spacer = new St.Widget();
        //this.add_actor(this._spacer);

        let panelGhost = new St.Bin({
            child: new Clutter.Clone({ source: Main.panel }),
            reactive: false,
            opacity: 0,
        });
        this.add_actor(panelGhost);

        this._searchEntry = new St.Entry({
            style_class: 'search-entry',
            /* Translators: this is the text displayed
               in the search entry when no search is
               active; it should not exceed ~30
               characters. */
            hint_text: _('Type to search'),
            track_hover: true,
            can_focus: true,
        });
        this._searchEntry.set_offscreen_redirect(Clutter.OffscreenRedirect.ALWAYS);
        let searchEntryBin = new St.Bin({
            child: this._searchEntry,
            x_align: Clutter.ActorAlign.CENTER,
        });
        this.add_actor(searchEntryBin);

        this._controls = new ControlsManagerMonitor(this._searchEntry, monitorIndex);
        this.add_child(this._controls);
    }
});

var ControlsManagerMonitor = GObject.registerClass(
class ControlsManagerMonitor extends OverviewControls.ControlsManager {
    _init(searchEntry, monitorIndex) {
        let layout = new ControlsLayout();
        St.Widget.prototype._init.call(this, {
            layout_manager: layout,
            x_expand: true,
            y_expand: true,
            clip_to_allocation: true,
        });

        this.dash = new Dash.Dash();
        this._dashSlider = new DashSlider(this.dash);
        this._dashSpacer = new DashSpacer();
        this._dashSpacer.setDashActor(this._dashSlider);
        
        let workspaceManager = global.workspace_manager;
        let activeWorkspaceIndex = workspaceManager.get_active_workspace_index();
                     
        this._workspaceAdjustment = new St.Adjustment({
            actor: this,
            value: activeWorkspaceIndex,
            lower: 0,
            page_increment: 1,
            page_size: 1,
            step_increment: 0,
            upper: workspaceManager.n_workspaces,
        });
        
        this._nWorkspacesNotifyId =
            workspaceManager.connect('notify::n-workspaces',
                this._updateAdjustment.bind(this));
        
        //this._thumbnailsBox =
        //    new WorkspaceThumbnail.ThumbnailsBox(this._workspaceAdjustment);
        this._thumbnailsBox = new ThumbnailsBoxMonitor(this._workspaceAdjustment, monitorIndex);
        this._thumbnailsSlider = new ThumbnailsSlider(this._thumbnailsBox);

        this.viewSelector = new ViewSelector.ViewSelector(searchEntry,
            this._workspaceAdjustment, this.dash.showAppsButton);
        this._pageChangedId = this.viewSelector.connect('page-changed', this._setVisibility.bind(this));
        this._pageEmptyId = this.viewSelector.connect('page-empty', this._onPageEmpty.bind(this));

        this._group = new St.BoxLayout({ name: 'overview-group',
                                         x_expand: true, y_expand: true });
        this.add_actor(this._group);

        this.add_actor(this._dashSlider);

        this._group.add_actor(this._dashSpacer);
        this._group.add_child(this.viewSelector);
        this._group.add_actor(this._thumbnailsSlider);

        //Main.overview.connect('showing', this._updateSpacerVisibility.bind(this));

        this.connect('destroy', this._onDestroy.bind(this));

        // Added
        /*
        let first = this._group.get_first_child();
        this._thumbnailsSlider.layout.slideDirection = OverviewControls.SlideDirection.LEFT;
        this._thumbnailsBox.remove_style_class_name('workspace-thumbnails');
        this._thumbnailsBox.set_style_class_name('workspace-thumbnails workspace-thumbnails-left');
        this._group.set_child_below_sibling(this._thumbnailsSlider, first)
        */
        this.dash.hide();
        this._thumbnailsSlider._getAlwaysZoomOut = () => true;

        /*
        this.viewSelector.show();
        this.viewSelector.animateToOverview();
        this.viewSelector.showApps();
        this.viewSelector._workspacesDisplay.hide();
        */
    }

    _onDestroy() {
        Main.overview.viewSelector.disconnect(this._pageChangedId);
        Main.overview.viewSelector.disconnect(this._pageEmptyId);
        super._onDestroy();
    }

    _setVisibility() {
        // Ignore the case when we're leaving the overview, since
        // actors will be made visible again when entering the overview
        // next time, and animating them while doing so is just
        // unnecessary noise
        if (!Main.overview.visible ||
            (Main.overview.animationInProgress && !Main.overview.visibleTarget))
            return;

        //let activePage = this.viewSelector.getActivePage();
        let activePage = Main.overview.viewSelector.getActivePage(); // From multi-monitor
        let dashVisible = activePage == ViewSelector.ViewPage.WINDOWS ||
                           activePage == ViewSelector.ViewPage.APPS;
        let thumbnailsVisible = activePage == ViewSelector.ViewPage.WINDOWS;

        if (dashVisible)
            this._dashSlider.slideIn();
        else
            this._dashSlider.slideOut();

        if (thumbnailsVisible)
            this._thumbnailsSlider.slideIn();
        else
            this._thumbnailsSlider.slideOut();
    }
});

var WorkspaceThumbnailMonitor = GObject.registerClass(
class WorkspaceThumbnailMonitor extends WorkspaceThumbnail.WorkspaceThumbnail {
    _init(metaWorkspace, monitorIndex) {
        St.Widget.prototype._init.call(this, {
            clip_to_allocation: true,
            style_class: 'workspace-thumbnail',
        });
        this._delegate = this;

        this.metaWorkspace = metaWorkspace;
        this.monitorIndex = monitorIndex; // Changed from `Main.layoutManager.primaryIndex`

        this._removed = false;

        this._contents = new Clutter.Actor();
        this.add_child(this._contents);

        this.connect('destroy', this._onDestroy.bind(this));

        this._createBackground();

        let workArea = Main.layoutManager.getWorkAreaForMonitor(this.monitorIndex);
        this.setPorthole(workArea.x, workArea.y, workArea.width, workArea.height);

        let windows = global.get_window_actors().filter(actor => {
            let win = actor.meta_window;
            return win.located_on_workspace(metaWorkspace);
        });

        // Create clones for windows that should be visible in the Overview
        this._windows = [];
        this._allWindows = [];
        this._minimizedChangedIds = [];
        for (let i = 0; i < windows.length; i++) {
            let minimizedChangedId =
                windows[i].meta_window.connect('notify::minimized',
                                               this._updateMinimized.bind(this));
            this._allWindows.push(windows[i].meta_window);
            this._minimizedChangedIds.push(minimizedChangedId);

            if (this._isMyWindow(windows[i]) && this._isOverviewWindow(windows[i]))
                this._addWindowClone(windows[i]);
        }

        // Track window changes
        this._windowAddedId = this.metaWorkspace.connect('window-added',
                                                         this._windowAdded.bind(this));
        this._windowRemovedId = this.metaWorkspace.connect('window-removed',
                                                           this._windowRemoved.bind(this));
        this._windowEnteredMonitorId = global.display.connect('window-entered-monitor',
                                                              this._windowEnteredMonitor.bind(this));
        this._windowLeftMonitorId = global.display.connect('window-left-monitor',
                                                           this._windowLeftMonitor.bind(this));

        this.state = ThumbnailState.NORMAL;
        this._slidePosition = 0; // Fully slid in
        this._collapseFraction = 0; // Not collapsed
    }

    _createBackground() {
        this._bgManager = new Background.BackgroundManager({ monitorIndex: this.monitorIndex, // Changed from `Main.layoutManager.primaryIndex`
                                                             container: this._contents,
                                                             vignette: false });
    }
});

var ThumbnailsBoxMonitor = GObject.registerClass(
class ThumbnailsBoxMonitor extends WorkspaceThumbnail.ThumbnailsBox {
    _init(scrollAdjustment, monitorIndex) {
        this.monitorIndex = monitorIndex;

        super._init(scrollAdjustment);

        // XXX
        //controls._thumbnailsBox.set_style_class_name('workspace-thumbnails workspace-thumbnails-left'); // XXX
        //this._updatePorthole();
    }

    addThumbnails(start, count) {
        let workspaceManager = global.workspace_manager;

        for (let k = start; k < start + count; k++) {
            let metaWorkspace = workspaceManager.get_workspace_by_index(k);
            let thumbnail = new WorkspaceThumbnailMonitor(metaWorkspace, this.monitorIndex); // Changed from `new WorkspaceThumbnail(metaWorkspace)`
            //let thumbnail = new WorkspaceThumbnail.WorkspaceThumbnail(metaWorkspace);
            thumbnail.setPorthole(this._porthole.x, this._porthole.y,
                                  this._porthole.width, this._porthole.height);
            this._thumbnails.push(thumbnail);
            this.add_actor(thumbnail);

            if (start > 0 && this._spliceIndex == -1) {
                // not the initial fill, and not splicing via DND
                thumbnail.state = ThumbnailState.NEW; 
                thumbnail.slide_position = 1; // start slid out
                this._haveNewThumbnails = true;
            } else {
                thumbnail.state = ThumbnailState.NORMAL;
            }

            this._stateCounts[thumbnail.state]++;
        }

        this._queueUpdateStates();

        // The thumbnails indicator actually needs to be on top of the thumbnails
        this.set_child_above_sibling(this._indicator, null);

        // Clear the splice index, we got the message
        this._spliceIndex = -1;
    }

    _updatePorthole() {
        this._porthole = Main.layoutManager.getWorkAreaForMonitor(this.monitorIndex);
        
        this.queue_relayout();
    }
});
