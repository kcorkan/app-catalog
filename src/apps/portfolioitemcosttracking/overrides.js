Ext.override(Rally.ui.grid.TreeGrid, {
    _mergeColumnConfigs: function(newColumns, oldColumns) {

        var mergedColumns= _.map(newColumns, function(newColumn) {
            var oldColumn = _.find(oldColumns, {dataIndex: this._getColumnName(newColumn)});
            if (oldColumn) {
                return this._getColumnConfigFromColumn(oldColumn);
            }

            return newColumn;
        }, this);

        mergedColumns = mergedColumns.concat(this.config.derivedColumns);
        return mergedColumns;
    },
    _getPersistableColumnConfig: function(column) {
        var columnConfig = this._getColumnConfigFromColumn(column),
            field = this._getModelField(columnConfig.dataIndex);

        if (field && field.getUUID && field.getUUID()) {
            columnConfig.dataIndex = field.getUUID();
        }
        return columnConfig;
    },
    reconfigureWithColumns: function(columnCfgs, reconfigureExistingColumns, suspendLoad) {
        console.log('reconfigureWithColumns', columnCfgs);
        columnCfgs = this._getStatefulColumns(columnCfgs);
        console.log('reconfigureWithColumns 2' , columnCfgs);

        if (!reconfigureExistingColumns) {
            columnCfgs = this._mergeColumnConfigs(columnCfgs, this.columns);
        }
        console.log('reconfigureWithColumns 3' , columnCfgs);
        this.columnCfgs = columnCfgs;
        this._buildColumns(true);
        this.getStore().fetch = this._buildFetch();

        this.on('reconfigure', function() {
            this.headerCt.setSortState();
        }, this, {single: true});
        this.reconfigure(null, this.columns);
        this.columns = this.headerCt.items.getRange();
        console.log('reconfigureWithColumns 4' , this.columns);
        if (!suspendLoad) {
            this.getStore().load();
        }
    }
});