(function () {
    var Ext = window.Ext4 || window.Ext;

    var defaultGridColumns = ['Name', 'ScheduleState', 'Blocked', 'PlanEstimate', 'Tasks', 'TaskEstimateTotal', 'TaskRemainingTotal', 'Owner', 'Defects', 'Discussion'];

    /**
     * Iteration Tracking Board App
     * The Iteration Tracking Board can be used to visualize and manage your User Stories and Defects within an Iteration.
     */
    Ext.define('Rally.apps.iterationtrackingboard.IterationTrackingBoardApp', {
        extend: 'Rally.app.TimeboxScopedApp',
        requires: [
            'Rally.data.Ranker',
            'Rally.data.wsapi.Filter',
            'Rally.data.wsapi.ModelFactory',
            'Rally.data.wsapi.TreeStoreBuilder',
            'Rally.ui.dialog.CsvImportDialog',
            'Rally.ui.gridboard.GridBoard',
            'Rally.ui.cardboard.plugin.FixedHeader',
            'Rally.ui.cardboard.plugin.Print',
            'Rally.ui.gridboard.plugin.GridBoardActionsMenu',
            'Rally.ui.gridboard.plugin.GridBoardAddNew',
            'Rally.ui.gridboard.plugin.GridBoardCustomFilterControl',
            'Rally.ui.gridboard.plugin.GridBoardInlineFilterControl',
            'Rally.ui.gridboard.plugin.GridBoardFieldPicker',
            'Rally.ui.cardboard.plugin.ColumnPolicy',
            'Rally.ui.gridboard.plugin.GridBoardToggleable',
            'Rally.ui.grid.plugin.TreeGridExpandedRowPersistence',
            'Rally.ui.grid.plugin.TreeGridChildPager',
            'Rally.ui.filter.view.ModelFilter',
            'Rally.ui.filter.view.OwnerFilter',
            'Rally.app.Message',
            'Rally.apps.iterationtrackingboard.StatsBannerField',
            'Rally.apps.iterationtrackingboard.statsbanner.IterationProgressDialog',
            'Rally.clientmetrics.ClientMetricsRecordable',
            'Rally.apps.common.RowSettingsField',
            'Rally.ui.gridboard.Export',
            'Rally.ui.gridboard.plugin.GridBoardSharedViewControl'
        ],

        mixins: [
            'Rally.clientmetrics.ClientMetricsRecordable'
        ],
        componentCls: 'iterationtrackingboard',
        alias: 'widget.rallyiterationtrackingboard',

        settingsScope: 'project',
        userScopedSettings: true,
        scopeType: 'iteration',
        autoScroll: false,

        config: {
            defaultSettings: {
                showCardAge: true,
                showStatsBanner: true,
                cardAgeThreshold: 3
            }
        },

        modelNames: ['User Story', 'Defect', 'Defect Suite', 'Test Set'],

        constructor: function(config) {
            _.defaults(config, { layout: 'anchor'});

            this.callParent(arguments);
        },

        onScopeChange: function() {
            if(!this.rendered) {
                this.on('afterrender', this.onScopeChange, this, {single: true});
                return;
            }

            var me = this;

            this.suspendLayouts();

            var grid = this.down('rallytreegrid');
            if (grid) {
                // reset page count to 1.
                // must be called here to reset persisted page count value.
                grid.fireEvent('storecurrentpagereset');
            }

            this._buildGridStore().then({
                success: function(gridStore) {
                    var model = gridStore.model;
                    if(_.isFunction(model.getArtifactComponentModels)) {
                        this.modelNames = _.intersection(_.pluck(gridStore.model.getArtifactComponentModels(),'displayName'),this.modelNames);
                    } else {
                        this.modelNames = [model.displayName];
                    }
                    this._addGridBoard(gridStore);
                },
                scope: this
            }).always(function() {
                me.resumeLayouts(true);
            });
        },

        getSettingsFields: function () {
            var fields = this.callParent(arguments);

            fields.push({
                type: 'cardage',
                config: {
                    margin: '0 0 0 80',
                    width: 300
                }
            });

            fields.push({
                name: 'groupHorizontallyByField',
                xtype: 'rowsettingsfield',
                fieldLabel: 'Swimlanes',
                margin: '10 0 0 0',
                mapsToMultiplePreferenceKeys: ['showRows', 'rowsField'],
                readyEvent: 'ready',
                isAllowedFieldFn: function() { return false; },
                explicitFields: [
                    {name: 'Blocked', value: 'Blocked'},
                    {name: 'Owner', value: 'Owner'},
                    {name: 'Sizing', value: 'PlanEstimate'},
                    {name: 'Expedite', value: 'Expedite'}
                ]
            });

            return fields;
        },

        getUserSettingsFields: function () {
            var fields = this.callParent(arguments);

            if (this.isFullPageApp !== false) {
                fields.push({
                    xtype: 'rallystatsbannersettingsfield',
                    fieldLabel: '',
                    mapsToMultiplePreferenceKeys: ['showStatsBanner']
                });
            }

            return fields;
        },

        _buildGridStore: function() {
            var context = this.getContext(),
                config = {
                    context: context.getDataContext(),
                    models: this.modelNames,
                    autoLoad: false,
                    remoteSort: true,
                    root: {expanded: true},
                    enableHierarchy: true,
                    pageSize: this.getGridPageSizes()[1],
                    childPageSizeEnabled: true,
                    fetch: ['PlanEstimate', 'Release', 'Iteration']
                };

            return Ext.create('Rally.data.wsapi.TreeStoreBuilder').build(config);
        },

        _addGridBoard: function (gridStore) {
            var context = this.getContext();

            this.remove('gridBoard');

            this.gridboard = this.add({
                itemId: 'gridBoard',
                xtype: 'rallygridboard',
                stateId: 'iterationtracking-gridboard',
                context: context,
                plugins: this._getGridBoardPlugins(),
                modelNames: this.modelNames,
                cardBoardConfig: this._getBoardConfig(),
                gridConfig: this._getGridConfig(gridStore),
                layout: 'anchor',
                storeConfig: {
                    useShallowFetch: false,
                    filters: this._getGridboardFilters(gridStore.model)
                },
                listeners: {
                    load: this._onLoad,
                    toggle: this._onToggle,
                    recordupdate: this._publishContentUpdatedNoDashboardLayout,
                    recordcreate: this._publishContentUpdatedNoDashboardLayout,
                    viewchange: this._onViewChange,
                    scope: this
                },
                height: Math.max(this._getAvailableGridBoardHeight(), 150)
            });
        },

        _getGridboardFilters: function(model) {
            var timeboxScope = this.getContext().getTimeboxScope(),
                timeboxFilter = timeboxScope.getQueryFilter(),
                filters = [timeboxFilter];

            if (!timeboxScope.isScheduled() && this.getContext().getSubscription().StoryHierarchyEnabled) {
                filters.push(this._createLeafStoriesOnlyFilter(model));
                filters.push(this._createUnassociatedDefectsOnlyFilter(model));
            }
            return filters;
        },

        _createLeafStoriesOnlyFilter: function(model) {
            var typeDefOid = model.getArtifactComponentModel('HierarchicalRequirement').typeDefOid;

            var userStoryFilter = Ext.create('Rally.data.wsapi.Filter', {
                property: 'TypeDefOid',
                value: typeDefOid
            });

            var noChildrenFilter = Ext.create('Rally.data.wsapi.Filter', {
                property: 'DirectChildrenCount',
                value: 0
            });

            var notUserStoryFilter = Ext.create('Rally.data.wsapi.Filter', {
                property: 'TypeDefOid',
                value: typeDefOid,
                operator: '!='
            });

            return userStoryFilter.and(noChildrenFilter).or(notUserStoryFilter);
        },

        _createUnassociatedDefectsOnlyFilter: function(model) {
            var typeDefOid = model.getArtifactComponentModel('Defect').typeDefOid,
                isADefect = Ext.create('Rally.data.wsapi.Filter', {
                    property: 'TypeDefOid',
                    value: typeDefOid
                }),
                hasNoParentTestCase = Ext.create('Rally.data.wsapi.Filter', {
                    property: 'TestCase',
                    operator: '=',
                    value: null
                }),
                hasNoParentRequirement = Ext.create('Rally.data.wsapi.Filter', {
                    property: 'Requirement',
                    operator: '=',
                    value: null
                }),
                hasNoParentDefectSuite = Ext.create('Rally.data.wsapi.Filter', {
                    property: 'DefectSuites.ObjectID',
                    operator: '=',
                    value: null
                }),
                isNotADefect = Ext.create('Rally.data.wsapi.Filter', {
                    property: 'TypeDefOid',
                    value: typeDefOid,
                    operator: '!='
                });

            return isADefect.and(hasNoParentTestCase.and(hasNoParentRequirement.and(hasNoParentDefectSuite))).or(isNotADefect);
        },

        _getBoardConfig: function() {
            var config = {
                plugins: [
                    {ptype: 'rallycardboardprinting', pluginId: 'print'},
                    {ptype: 'rallyfixedheadercardboard'}
                ],
                columnConfig: {
                    additionalFetchFields: ['PortfolioItem'],
                    plugins: [{
                        ptype: 'rallycolumnpolicy',
                        app: this
                    }],
                    requiresModelSpecificFilters: false,
                    fields: (this.getSetting('cardFields') && this.getSetting('cardFields').split(',')) ||
                        ['Parent', 'Tasks', 'Defects', 'Discussion', 'PlanEstimate', 'Iteration']
                },
                cardConfig: {
                    showAge: this.getSetting('showCardAge') ? this.getSetting('cardAgeThreshold') : -1
                },
                listeners: {
                    filter: this._onBoardFilter,
                    filtercomplete: this._onBoardFilterComplete
                }
            };

            if (this.getSetting('showRows') && this.getSetting('rowsField')) {
                Ext.merge(config, {
                    rowConfig: {
                        field: this.getSetting('rowsField'),
                        sortDirection: 'ASC'
                    }
                });
            }

            return config;
        },

        _getAvailableGridBoardHeight: function() {
            var height = this.getHeight();
            if (this.getHeader()) {
                height -= this.getHeader().getHeight();
            }
            return height;
        },

        _getGridBoardPlugins: function() {
            var context = this.getContext(),
                skinnyFilter = !!context.isFeatureEnabled('F10466_INLINE_FILTER_UI_ENHANCEMENTS');

            return [
                {
                    ptype: 'rallygridboardaddnew',
                    addNewControlConfig: {
                        stateful: true,
                        stateId: context.getScopedStateId('iteration-tracking-add-new')
                    }
                },
                {
                    ptype:'rallygridboardinlinefiltercontrol',
                    inline: skinnyFilter,
                    skinny: skinnyFilter,
                    inlineFilterButtonConfig: {
                        stateful: true,
                        stateId: context.getScopedStateId('iteration-tracking-inline-filter'),
                        filterChildren: true,
                        modelNames: this.modelNames,
                        inlineFilterPanelConfig: {
                            quickFilterPanelConfig: {
                                defaultFields: [
                                    'ArtifactSearch',
                                    'Owner',
                                    'ScheduleState',
                                    'ModelType'
                                ],
                                addQuickFilterConfig: {
                                    blackListFields: ['Iteration', 'PortfolioItem', 'ObjectUUID'],
                                    whiteListFields: ['Milestones', 'Tags']
                                }
                            },
                            advancedFilterPanelConfig: {
                                advancedFilterRowsConfig: {
                                    propertyFieldConfig: {
                                        blackListFields: ['Iteration', 'PortfolioItem', 'ObjectUUID'],
                                        whiteListFields: ['Milestones', 'Tags']
                                    }
                                }
                            }
                        }
                    }
                },
                'rallygridboardtoggleable',
                {
                    ptype: 'rallygridboardactionsmenu',
                    itemId: 'printExportMenuButton',
                    menuItems: [
                        {
                            text: 'Import User Stories...',
                            handler: this._importHandler({
                                type: 'HierarchicalRequirement',
                                title: 'Import User Stories'
                            })
                        }, {
                            text: 'Import Tasks...',
                            handler: this._importHandler({
                                type: 'Task',
                                title: 'Import Tasks'
                            })
                        }, {
                            text: 'Export...',
                            handler: this._exportHandler,
                            scope: this
                        }, {
                            text: 'Print...',
                            handler: this._printHandler,
                            scope: this
                        }],
                    buttonConfig: {
                        iconCls: 'icon-export',
                        toolTipConfig: {
                            html: 'Import/Export/Print',
                            anchor: 'top',
                            hideDelay: 0
                        }
                    }
                },
                {
                    ptype: 'rallygridboardfieldpicker',
                    headerPosition: 'left',
                    gridFieldBlackList: [
                        'Estimate',
                        'ToDo'
                    ],
                    boardFieldBlackList: [
                        'Successors',
                        'Predecessors'
                    ],
                    modelNames: this.modelNames
                },
                this._getSharedViewConfig()
            ];
        },

        setSize: function() {
            this.callParent(arguments);
            this._resizeGridBoardToFillSpace();
        },

        _importHandler: function(options) {
            return _.bind(function() {
                Ext.widget({
                    xtype: 'rallycsvimportdialog',
                    type: options.type,
                    title: options.title,
                    params: {
                        iterationOid: this._getIterationOid()
                    }
                });
            }, this);
        },

        _exportHandler: function() {
            window.location = Rally.ui.gridboard.Export.buildCsvExportUrl(this.gridboard.getGridOrBoard());
        },

        _printHandler: function() {
            var timeboxScope = this.getContext().getTimeboxScope();

            Ext.create('Rally.ui.grid.TreeGridPrintDialog', {
                grid: this.gridboard.getGridOrBoard(),
                treeGridPrinterConfig: {
                    largeHeaderText: 'Iteration Summary',
                    smallHeaderText: timeboxScope.getRecord() ? timeboxScope.getRecord().get('Name') : 'Unscheduled'
                }
            });
        },

        _getIterationOid: function() {
            var iterationId = '-1';
            var timebox = this.getContext().getTimeboxScope();

            if (timebox && timebox.getRecord()) {
                iterationId = timebox.getRecord().getId();
            }
            return iterationId;
        },

        _resizeGridBoardToFillSpace: function() {
            if (this.gridboard) {
                this.gridboard.setHeight(this._getAvailableGridBoardHeight());
            }
        },

        _getSharedViewConfig: function() {
            var context = this.getContext();
            return {
                ptype: 'rallygridboardsharedviewcontrol',
                sharedViewConfig: {
                    stateful: true,
                    stateId: this.getContext().getScopedStateId('iteration-tracking-shared-view'),
                    defaultViews: _.map(this._getDefaultViews(), function(view){
                        Ext.apply(view, {
                            Value: Ext.JSON.encode(view.Value, true)
                        });
                        return view;
                    }, this),
                    enableUrlSharing: this.isFullPageApp !== false,
                    enableReadingUserPref: context.isFeatureEnabled('S83433_THE_PREFERENCE') && context.isFeatureEnabled('DE25285_RETURN_OF_THE_PREFERENCE')
                },
                enableGridEditing: context.isFeatureEnabled('S91174_ISP_SHARED_VIEWS_MAKE_PREFERENCE_NAMES_UPDATABLE')
            };
        },

        _getDefaultViews: function(){
            var  rankColumnDataIndex = this.getContext().getWorkspace().WorkspaceConfiguration.DragDropRankingEnabled ?
                Rally.data.Ranker.RANK_FIELDS.DND : Rally.data.Ranker.RANK_FIELDS.MANUAL;


            return [
                {
                    Name: 'Defect Status',
                    identifier: 1,
                    Value: {
                        toggleState: 'grid',
                        columns: [
                            { dataIndex: rankColumnDataIndex},
                            { dataIndex: 'Name'},
                            { dataIndex: 'ScheduleState'},
                            { dataIndex: 'Discussion'},
                            { dataIndex: 'Priority'},
                            { dataIndex: 'Severity'},
                            { dataIndex: 'FoundInBuild'},
                            { dataIndex: 'FixedInBuild'},
                            { dataIndex: 'Owner'}
                        ],
                        sorters:[{ property: rankColumnDataIndex, direction: 'ASC'}]
                    }
                },
                {
                    Name: 'Task Status',
                    identifier: 2,
                    Value: {
                        toggleState: 'grid',
                        columns: [
                            { dataIndex: rankColumnDataIndex},
                            { dataIndex: 'Name'},
                            { dataIndex: 'ScheduleState'},
                            { dataIndex: 'PlanEstimate'},
                            { dataIndex: 'TaskEstimateTotal'},
                            { dataIndex: 'TaskActualTotal'},
                            { dataIndex: 'TaskRemainingTotal'},
                            { dataIndex: 'Owner'}
                        ],
                        sorters:[{ property: rankColumnDataIndex, direction: 'ASC'}]
                    }
                },
                {
                    Name: 'Test Status',
                    identifier: 3,
                    Value: {
                        toggleState: 'grid',
                        columns: [
                            { dataIndex: rankColumnDataIndex},
                            { dataIndex: 'Name'},
                            { dataIndex: 'ScheduleState'},
                            { dataIndex: 'Discussion'},
                            { dataIndex: 'LastVerdict'},
                            { dataIndex: 'LastBuild'},
                            { dataIndex: 'LastRun'},
                            { dataIndex: 'Defects'},
                            { dataIndex: 'Priority'},
                            { dataIndex: 'Owner'}
                        ],
                        sorters:[{ property: rankColumnDataIndex, direction: 'ASC'}]
                    }
                }
            ];
        },

        _onViewChange: function(){
            this.onScopeChange();
        },

        _getGridConfig: function (gridStore) {
            var context = this.getContext(),
                stateString = 'iteration-tracking-treegrid',
                stateId = context.getScopedStateId(stateString),
                useFixedHeightRows = Ext.isIE;

            var gridConfig = {
                bufferedRenderer: true,
                columnCfgs: this._getGridColumns(),
                enableBulkEdit: true,
                enableInlineAdd: true,
                enableSummaryRow: true,
                expandAllInColumnHeaderEnabled: true,
                inlineAddConfig: {
                    enableAddPlusNewChildStories: false
                },
                noDataHelpLink: {
                    url: "https://help.rallydev.com/tracking-iterations#filter",
                    title: "Filter Help Page"
                },
                pagingToolbarCfg: {
                    pageSizes: this.getGridPageSizes(),
                    comboboxConfig: {
                        defaultSelectionPosition: 'last'
                    }
                },
                plugins: [],
                stateful: true,
                stateId: stateId,
                store: gridStore,
                variableRowHeight: !useFixedHeightRows
            };

            gridConfig.plugins.push({
                ptype: 'rallytreegridexpandedrowpersistence'
            });

            return gridConfig;
        },

        _getGridColumns: function (columns) {
            return columns ? _.without(columns, 'FormattedID') : defaultGridColumns;
        },

        _onLoad: function () {
            this._publishContentUpdated();

            var additionalMetricData = {};

            if  (this.gridboard.getToggleState() === 'board') {
                additionalMetricData = {
                    miscData: {
                        swimLanes: this.getSetting('showRows'),
                        swimLaneField: this.getSetting('rowsField')
                    }
                };
            }

            this.recordComponentReady(additionalMetricData);

            if (Rally.BrowserTest) {
                Rally.BrowserTest.publishComponentReady(this);
            }
        },

        _onBoardFilter: function () {
            this.setLoading(true);
        },

        _onBoardFilterComplete: function () {
            this.setLoading(false);
        },

        _hidePrintButton: function(hide, gridboard) {
            var button, menuItem;

            if (gridboard) {
                button = _.find(gridboard.plugins, {itemId: 'printExportMenuButton'});

                if (button) {
                    menuItem = _.find(button.menuItems, {text: 'Print...'});

                    if (menuItem) {
                        menuItem.hidden = hide;
                    }
                }
            }
        },

        _onToggle: function (toggleState, gridOrBoard, gridboard) {
            var appEl = this.getEl();

            if (toggleState === 'board') {
                appEl.replaceCls('grid-toggled', 'board-toggled');
                this._hidePrintButton(true, gridboard);
            } else {
                appEl.replaceCls('board-toggled', 'grid-toggled');
                this._hidePrintButton(false, gridboard);
            }
            this._publishContentUpdated();
        },

        _publishContentUpdated: function () {
            this.fireEvent('contentupdated');
        },

        _publishContentUpdatedNoDashboardLayout: function () {
            this.fireEvent('contentupdated', {dashboardLayout: false});
        },

        getGridPageSizes: function() {
            return Ext.isIE ? [10, 25, 50] : [10, 25, 50, 100];
        }
    });
})();
