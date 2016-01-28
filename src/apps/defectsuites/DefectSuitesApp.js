(function () {
    var Ext = window.Ext4 || window.Ext;

    Ext.define('Rally.apps.defectsuites.DefectSuitesApp', {
        extend: 'Rally.app.GridBoardApp',
        requires: [
            'Rally.ui.gridboard.plugin.GridBoardInlineFilterControl',
            'Rally.ui.gridboard.plugin.GridBoardSharedViewControl'
        ],

        columnNames: ['DisplayColor','Name','State','Priority','Severity','Owner'],
        enableXmlExport: true,
        modelNames: ['DefectSuite'],
        statePrefix: 'defectsuites',

        getAddNewConfig: function () {
            var config = {};
            if (this.getContext().isFeatureEnabled('F8943_UPGRADE_TO_NEWEST_FILTERING_SHARED_VIEWS_ON_MANY_PAGES')) {
                config.margin = 0;
            }

            return _.merge(this.callParent(arguments), config);
        },

        getGridBoardConfig: function () {
            var config = this.callParent(arguments);
            return _.merge(config, {
                listeners: {
                    viewchange: function() {
                        this.loadGridBoard();
                    },
                    scope: this
                }
            });
        },

        getGridBoardCustomFilterControlConfig: function () {
            var context = this.getContext();
            var blackListFields = ['ObjectUUID', 'Subscription'];
            var whiteListFields = ['Milestones', 'Tags'];

            if (context.isFeatureEnabled('F8943_UPGRADE_TO_NEWEST_FILTERING_SHARED_VIEWS_ON_MANY_PAGES')) {
                return {
                    ptype: 'rallygridboardinlinefiltercontrol',
                    inline: true,
                    skinny: true,
                    inlineFilterButtonConfig: {
                        stateful: true,
                        stateId: context.getScopedStateId('defect-suites-inline-filter'),
                        filterChildren: true,
                        modelNames: this.modelNames,
                        inlineFilterPanelConfig: {
                            quickFilterPanelConfig: {
                                defaultFields: [
                                    'ArtifactSearch',
                                    'Owner'
                                ],
                                addQuickFilterConfig: {
                                    blackListFields: blackListFields,
                                    whiteListFields: whiteListFields
                                }
                            },
                            advancedFilterPanelConfig: {
                                advancedFilterRowsConfig: {
                                    propertyFieldConfig: {
                                        blackListFields: blackListFields,
                                        whiteListFields: whiteListFields
                                    }
                                }
                            }
                        }
                    }
                };
            }

            return {};
        },

        getSharedViewConfig: function() {
            var context = this.getContext();
            if (context.isFeatureEnabled('F8943_UPGRADE_TO_NEWEST_FILTERING_SHARED_VIEWS_ON_MANY_PAGES')) {
                return {
                    ptype: 'rallygridboardsharedviewcontrol',
                    sharedViewConfig: {
                        stateful: true,
                        stateId: context.getScopedStateId('defect-suites-shared-view'),
                        enableUrlSharing: this.isFullPageApp !== false
                    },
                    enableGridEditing: context.isFeatureEnabled('S91174_ISP_SHARED_VIEWS_MAKE_PREFERENCE_NAMES_UPDATABLE')
                };
            }

            return {};
        }

    });
})();