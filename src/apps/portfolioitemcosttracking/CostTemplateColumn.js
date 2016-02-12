

Ext.define('Rally.apps.portfolioitemcosttracking.CostTemplate', {
    extend: 'Ext.grid.column.Template',
    alias: ['widget.costtemplatecolumn'],

    align: 'right',

    initComponent: function(){
        var me = this;

        Ext.QuickTips.init();

        me.tpl = new Ext.XTemplate('<tpl><div data-qtip="{[this.getTooltip(values)]}" style="cursor:pointer;text-align:right;">{[this.getCost(values)]}</div></tpl>',{
            costField: me.costField,

            getCost: function(values){
                if (values[this.costField] === null){
                    return Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.notAvailableText;
                } else {
                    var html = Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.formatCost(values[this.costField] || 0);
                    if (values._notEstimated && this.costField === '_rollupDataTotalCost'){
                        html = '<span class="picto icon-warning warning" style="color:#FAD200;font-size:10px;"></span>' + html;
                    }
                    return html;
                }
            },
            getTooltip: function(values){
                if (values._rollupDataToolTip){
                    return values._rollupDataToolTip;
                }
                return '';
            }

        });
        me.hasCustomRenderer = true;
        me.callParent(arguments);
    },
    getValue: function(){
        return values[this.costField] || 0;
    },
    defaultRenderer: function(value, meta, record) {
        var data = Ext.apply({}, record.data._rollupData); //, record.getAssociatedData());
        return this.tpl.apply(data);
    }
});

///**
// * Extended the cost template column class for each specific type
// * becuase if I pass in a custom property (eg costField), it
// * gets lost when the columns refresh
// *
// */
//
//Ext.define('Rally.apps.portfolioitemcosttracking.ActualCostTemplate',{
//    extend: 'Rally.apps.portfolioitemcosttracking.CostTemplate',
//    alias: ['widget.actualcosttemplatecolumn'],
//    costField: '_rollupDataActualCost'
//});
//
//Ext.define('Ext.TotalCostTemplate',{
//    extend: 'Ext.CostTemplate',
//    alias: ['widget.totalcosttemplatecolumn'],
//    costField: '_rollupDataTotalCost'
//});
//
//Ext.define('Ext.RemainingCostTemplate',{
//    extend: 'Ext.CostTemplate',
//    alias: ['widget.remainingcosttemplatecolumn'],
//    costField: '_rollupDataRemainingCost'
//});
//
//Ext.define('Ext.PreliminaryBudgetTemplate',{
//    extend: 'Ext.CostTemplate',
//    alias: ['widget.preliminarybudgettemplatecolumn'],
//    costField: '_rollupDataPreliminaryBudget'
//});