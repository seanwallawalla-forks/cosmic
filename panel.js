const { Atk, Clutter, Gio, GLib, GObject, Meta, Shell, St } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const extension = ExtensionUtils.getCurrentExtension();
const Main = imports.ui.main;
const Panel = imports.ui.panel;
const LayoutManager = imports.ui.layout;

var { CosmicTopBarButton } = extension.imports.topBarButton;
var { OVERVIEW_WORKSPACES, OVERVIEW_APPLICATIONS, OVERVIEW_LAUNCHER } = extension.imports.overview;
var { overview_visible, overview_show, overview_hide, overview_toggle } = extension.imports.overview;
var { settings_new_schema } = extension.imports.settings;

// could inject modification
const PANEL_ITEM_IMPLEMENTATIONS = { ...Panel.PANEL_ITEM_IMPLEMENTATIONS, activities: undefined, appMenu: undefined, aggregateMenu: undefined };

var PanelMonitor = GObject.registerClass({
}, class PanelMonitor extends Panel.Panel {
    _init(monitorIndex) {
        super._init();

        this.y_align = Clutter.ActorAlign.START;
        this.add_constraint(new LayoutManager.MonitorConstraint({ index: monitorIndex }));
        this.get_parent().remove_child(this);
        Main.layoutManager.addChrome(this, { affectsStruts: true, trackFullscreen: true });

        const settings = settings_new_schema(extension.metadata["settings-schema"]);

        const workspaces_button = new CosmicTopBarButton(settings, OVERVIEW_WORKSPACES);
        this.addToStatusArea("cosmic_workspaces", workspaces_button, 0, "left");

        // Add applications button
        const applications_button = new CosmicTopBarButton(settings, OVERVIEW_APPLICATIONS);
        this.addToStatusArea("cosmic_applications", applications_button, 1, "left");
    }

    _ensureIndicator(role) {
        let indicator = this.statusArea[role];  
        if (!indicator) {
            let constructor = PANEL_ITEM_IMPLEMENTATIONS[role];
            if (!constructor) {
                return null;
            }
            indicator = new constructor(this);
            this.statusArea[role] = indicator;
        }
        return indicator;
    }
});

