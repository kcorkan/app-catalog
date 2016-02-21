Ext.define('Rally.apps.portfolioitemcosttracking.UserStoryRollupItem', {
    extend: 'Rally.apps.portfolioitemcosttracking.RollupItem',
    constructor: function(record, totalFn, actualFn) {

        var data = record.data;
        if (record.getData && record.getData()){
            data = record.getData();
        }

        if (data){
            this.__totalUnits = totalFn(data);
            this.__actualUnits = actualFn(data);
            this._notEstimated = false;
            var costPerUnit = Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.getCostPerUnit(data.Project._ref);

            this._rollupDataTotalCost = (this.__totalUnits * costPerUnit) || 0;
            this._rollupDataActualCost = (this.__actualUnits * costPerUnit) || 0;
            this._rollupDataRemainingCost = this._rollupDataTotalCost - this._rollupDataActualCost;

            this.parent = record.get('PortfolioItem') && record.get('PortfolioItem').ObjectID || null;
            this.objectID = data.ObjectID;

            this._rollupDataPreliminaryBudget = null;
            this._rollupDataToolTip = null;

            Ext.apply(this, data);
        }
    }
});