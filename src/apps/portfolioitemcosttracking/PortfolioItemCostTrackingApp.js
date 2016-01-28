Ext.define('Rally.apps.portfolioitemcosttracking.PortfolioItemsCostTrackingApp', {
    extend: 'Rally.apps.common.PortfolioItemsGridBoardApp',
    printHeaderLabel: 'Portfolio Items',
    statePrefix: 'portfolio-tree',

    //extend: 'Rally.app.App',
    componentCls: 'app',

    config: {
        defaultSettings: {
            piTypePickerConfig: {
                renderInGridHeader: true
            },
            selectedCalculationType: 'points',
            normalizedCostPerUnit: 1000,
            projectCostPerUnit: {},
            currencySign: '$',
            preliminaryBudgetField: 'PreliminaryEstimate'
        }
    },
    toggleState: 'grid',
    enableAddNew: false,
    enableGridBoardToggle: false,
    allowExpansionStateToBeSaved: false,

    items: [],

    portfolioItemRollupData: {},


    launch: function(){
        this.callParent();
    },
    loadModelNames: function () {
        var promises = [this.fetchDoneStates(), this._createPITypePicker()];
        return Deft.Promise.all(promises).then({
            success: function (results) {
                this.currentType = results[1];
                this._initializeSettings(this.getSettings(), results[0], this.piTypePicker);
                this._initializeRollupData(this.currentType.get('TypePath'));
                return [this.currentType.get('TypePath')];
            },
            scope: this
        });
    },
    /**
     * We need to override this to show the picker in the grid header and also save state
     * rather than as a configuration
     */

    _createPITypePicker: function () {
        if (this.piTypePicker && this.piTypePicker.destroy) {
            this.piTypePicker.destroy();
        }

        var deferred = new Deft.Deferred();

        var piTypePickerConfig = {
            preferenceName: this.getStateId('typepicker'),
            //stateful: true,
            //stateId: this.getContext().getScopedStateId('cb-type'),
            context: this.getContext(),
            listeners: {
                change: this._onTypeChange,
                ready: {
                    fn: function (picker) {
                        deferred.resolve(picker.getSelectedType());
                    },
                    single: true
                },
                scope: this
            }
        };

        this.piTypePicker = Ext.create('Rally.ui.combobox.PortfolioItemTypeComboBox', piTypePickerConfig);
        this.on('gridboardadded', function() {
            var headerContainer = this.gridboard.getHeader().getLeft();
            headerContainer.add(this.piTypePicker);
        });

        return deferred.promise;
    },

    getGridStoreConfig: function () {
        return this.gridStoreConfig || {};
    },
    getGridConfig: function (options) {


        var customColumns = this.getDerivedColumns() || [],
            columnCfgs = Ext.Array.merge(this.getColumnCfgs() || [], customColumns);

        var config = {
            xtype: 'rallytreegrid',
            alwaysShowDefaultColumns: false,
            bufferedRenderer: true,
            columnCfgs: columnCfgs,
            derivedColumns: customColumns,
            enableBulkEdit: true,
            allowExpansionStateToBeSaved: this.allowExpansionStateToBeSaved,
            enableInlineAdd: Rally.data.ModelTypes.areArtifacts(this.modelNames),
            enableRanking: this._shouldEnableRanking(),
            enableSummaryRow: Rally.data.ModelTypes.areArtifacts(this.modelNames),
            expandAllInColumnHeaderEnabled: true,
            plugins: this.getGridPlugins(),
            stateId: this.getScopedStateId('grid2'),
            stateful: true,
            store: options && options.gridStore,
            storeConfig: {
                filters: this.getPermanentFilters()
            }
        };

        if (this.modelNames.length === 1 && !Rally.data.ModelTypes.isArtifact(this.modelNames[0])) {
            config.noDataItemName = this.modelNames[0].toLowerCase();
        }
        var cols = _.merge( config, this.gridConfig );

        return cols;
    },
    _initializeRollupData: function(newType){
        if (this.rollupData){
            this.rollupData.destroy();
        }
        this.rollupData = Ext.create('PortfolioItemCostTracking.RollupCalculator', {
            portfolioItemType: newType
        });
    },
    _initializePortfolioItemTypes: function(cb){

        var items = cb.getStore().data.items,
            portfolioItemTypes = new Array(items.length);

        Ext.Array.each(items, function(item){
                var idx = Number(item.get('Ordinal'));
                portfolioItemTypes[idx] = { typePath: item.get('TypePath'), name: item.get('Name'), ordinal: idx };
        });
        Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.portfolioItemTypes = portfolioItemTypes;
    },
    _onTypeChange: function (picker) {
        var newType = picker.getSelectedType();

        if (this._pickerTypeChanged(picker)) {
            this.currentType = newType;
            this.modelNames = [newType.get('TypePath')];
            this._initializeRollupData(newType.get('TypePath'));
            this.gridboard.fireEvent('modeltypeschange', this.gridboard, [newType]);
        }
    },
    _initializeSettings: function(settings, doneScheduleStates, piTypePicker){

        Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.notAvailableText = "--";
        Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.currencySign = settings.currencySign;
        Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.currencyPrecision = 0;
        Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.currencyEnd = false;
        if (doneScheduleStates){
            Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.completedScheduleStates = doneScheduleStates;
        }
        Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.normalizedCostPerUnit = settings.normalizedCostPerUnit;

        var project_cpu = settings.projectCostPerUnit || {};
        if (!Ext.isObject(project_cpu)){
            project_cpu = Ext.JSON.decode(project_cpu);
        }
        Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.projectCostPerUnit = project_cpu;

        Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.preliminaryBudgetField = settings.preliminaryBudgetField;

        Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.setCalculationType(settings.selectedCalculationType);

        this._initializePortfolioItemTypes(piTypePicker);

    },
    _showExportMenu: function () {
        var columnCfgs = this.down('rallytreegrid').columnCfgs,
            additionalFields = _.filter(columnCfgs, function(c){ return (c.xtype === 'rallyfieldcolumn'); });

        additionalFields = _.pluck(additionalFields, 'dataIndex');

        var filters = this.down('rallygridboard').currentCustomFilter.filters || [],
            fetch = Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.getTreeFetch(additionalFields),
            root_model = this.currentType.get('TypePath');

        var exporter = new PortfolioItemCostTracking.Exporter();

        exporter.fetchExportData(root_model,filters,fetch,columnCfgs).then({
            scope: this,
            success: function(csv){
                var filename = Ext.String.format("export-{0}.csv",Ext.Date.format(new Date(),"Y-m-d-h-i-s"));
                exporter.saveCSVToFile(csv, filename);
            },
            failure: function(msg){
                Rally.ui.notify.Notifier.showError({message: "An error occurred fetching the data to export:  " + msg});
            }
        });
    },
    _loadRollupData: function(records){

        var loader = Ext.create('PortfolioItemCostTracking.RollupDataLoader',{
            context: this.getContext(),
            rootRecords: records,
            listeners: {
                rollupdataloaded: function(portfolioHash, stories){
                    this._processRollupData(portfolioHash,stories,records);
                },
                loaderror: this._handleLoadError,
                statusupdate: this._showStatus,
                scope: this
            }
        });
        loader.load(records);
    },
    _handleLoadError: function(msg){
        Rally.ui.notify.Notifier.showError({message: msg});
    },
    _processRollupData: function(portfolioHash, stories, records){
        var me = this;
        portfolioHash[records[0].get('_type').toLowerCase()] = records;
        this.rollupData.addRollupRecords(portfolioHash, stories);
        this.rollupData.updateModels(records);

        me._showStatus(null);
    },
    _showStatus: function(message){
            if (message) {
                Rally.ui.notify.Notifier.showStatus({
                    message: message,
                    showForever: true,
                    closable: false,
                    animateShowHide: false
                });
            } else {
                Rally.ui.notify.Notifier.hide();
            }
    },
    _getExportItems: function() {
        return [{
                text: 'Export to CSV...',
                handler: this._showExportMenu,
                scope: this
        }];
    },
    _getImportItems: function(){
        return [];
    },
    _getPrintItems: function(){
        return [];
    },
    _getTreeGridStore: function () {

        var fetch = Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.getTreeFetch([]);
        console.log('fetch', fetch);
        return Ext.create('Rally.data.wsapi.TreeStoreBuilder').build(_.merge({
            autoLoad: false,
            childPageSizeEnabled: true,
            context: this._getGridBoardContext().getDataContext(),
            enableHierarchy: true,
            fetch: _.union(['Workspace'], this.columnNames, fetch),
            models: _.clone(this.models),
            pageSize: 25,
            remoteSort: true,
            root: {expanded: true}
        }, this.getGridStoreConfig())).then({
            success: function (treeGridStore) {
                treeGridStore.model.addField({name: '_rollupData', type: 'auto', defaultValue: null});
                treeGridStore.on('load', this._fireTreeGridReady, this, { single: true });
                treeGridStore.on('load', this.updateDerivedColumns, this);
                return { gridStore: treeGridStore };
            },
            scope: this
        });
    },
    updateDerivedColumns: function(store, node, records){
        if (!store.model.getField('_rollupData')){
            store.model.addField({name: '_rollupData', type: 'auto', defaultValue: null});
        }

        var unloadedRecords = this.rollupData.updateModels(records);

        if (unloadedRecords && unloadedRecords.length > 0 && node.parentNode === null){
            this._loadRollupData(unloadedRecords);
        }
    },
    getDerivedColumns: function(){

        return [{
            text: "Actual Cost To Date",
            xtype: 'actualcosttemplatecolumn',
            dataIndex: '_rollupData',
            tooltip: Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.getHeaderTooltip('_rollupDataActualCost')
        },{
            text: "Remaining Cost",
            xtype: 'remainingcosttemplatecolumn',
            dataIndex: '_rollupData',
            tooltip: Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.getHeaderTooltip('_rollupDataRemainingCost')
        }, {
            text: 'Total Projected',
            xtype: 'totalcosttemplatecolumn',
            dataIndex: '_rollupData',
            tooltip: Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.getHeaderTooltip('_rollupDataTotalCost')
        },{
            text: 'Preliminary Budget',
            xtype: 'preliminarybudgettemplatecolumn',
            dataIndex: '_rollupData',
            tooltip: Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.getHeaderTooltip('_rollupDataPreliminaryBudget')
        }];
    },
    getColumnCfgs: function(){

        return  [{
            dataIndex: 'Name',
            text: 'Name',
            flex: 5
        },{
            dataIndex: 'Project',
            text: 'Project',
            editor: false
        },{
            dataIndex: 'LeafStoryPlanEstimateTotal',
            text: 'Plan Estimate Total'
        }, {
            dataIndex: 'PercentDoneByStoryPlanEstimate',
            text: '% Done by Story Points'
        }];
    },
    getSettingsFields: function() {
        return Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.getFields(this.getSettings());
    },
    onSettingsUpdate: function(settings){

        this._initializeSettings(settings,null,this.piTypePicker);
        this._initializeRollupData(this.currentType.get('TypePath'));
        this.loadGridBoard();
    },
    onDestroy: function() {
        this.callParent(arguments);
        if (this.rollupData){
            delete this.rollupData;
        }
    },
    fetchDoneStates: function(){
        var deferred = Ext.create('Deft.Deferred');
        console.log('fetchDoneStates', new Date());
        Rally.data.ModelFactory.getModel({
            type: 'HierarchicalRequirement',
            success: function(model) {
                var field = model.getField('ScheduleState');
                field.getAllowedValueStore().load({
                    callback: function(records, operation, success) {
                        console.log('fetchDoneStates callback', new Date());
                        if (success){
                            var values = [];
                            for (var i=records.length - 1; i > 0; i--){
                                values.push(records[i].get('StringValue'));
                                if (records[i].get('StringValue') == "Accepted"){
                                    i = 0;
                                }
                            }
                            deferred.resolve(values);
                        } else {
                            deferred.reject('Error loading ScheduleState values for User Story:  ' + operation.error.errors.join(','));
                        }
                    },
                    scope: this
                });
            },
            failure: function() {
                var error = "Could not load schedule states";
                deferred.reject(error);
            }
        });
        return deferred.promise;
    }
});
