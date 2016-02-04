Ext.define('Rally.apps.portfolioitemcosttracking.Exporter',{

    mixins: {
        observable: 'Ext.util.Observable'
    },
    constructor: function (config) {
        this.mixins.observable.constructor.call(this, config);
    },
    saveCSVToFile:function(csv,file_name,type_object){
        if (type_object === undefined){
            type_object = {type:'text/csv;charset=utf-8'};
        }
        this.saveAs(csv,file_name, type_object);
    },
    saveAs: function(textToWrite, fileName)
    {
        if (Ext.isIE9m){
            Rally.ui.notify.Notifier.showWarning({message: "Export is not supported for IE9 and below."});
            return;
        }

        var textFileAsBlob = null;
        try {
            textFileAsBlob = new Blob([textToWrite], {type:'text/plain'});
        }
        catch(e){
            window.BlobBuilder = window.BlobBuilder ||
                        window.WebKitBlobBuilder ||
                    window.MozBlobBuilder ||
                    window.MSBlobBuilder;
            if (window.BlobBuilder && e.name === 'TypeError'){
                bb = new BlobBuilder();
                bb.append([textToWrite]);
                textFileAsBlob = bb.getBlob("text/plain");
            }

        }

        if (!textFileAsBlob){
            Rally.ui.notify.Notifier.showWarning({message: "Export is not supported for this browser."});
            return;
        }

        var fileNameToSaveAs = fileName;

        if (Ext.isIE10p){
            window.navigator.msSaveOrOpenBlob(textFileAsBlob,fileNameToSaveAs); // Now the user will have the option of clicking the Save button and the Open button.
            return;
        }

        var url = this.createObjectURL(textFileAsBlob);

        if (url){
            var downloadLink = document.createElement("a");
            if ("download" in downloadLink){
                downloadLink.download = fileNameToSaveAs;
            } else {
                //Open the file in a new tab
                downloadLink.target = "_blank";
            }

            downloadLink.innerHTML = "Download File";
            downloadLink.href = url;
            if (!Ext.isChrome){
                // Firefox requires the link to be added to the DOM
                // before it can be clicked.
                downloadLink.onclick = this.destroyClickedElement;
                downloadLink.style.display = "none";
                document.body.appendChild(downloadLink);
            }
            downloadLink.click();
        } else {
            Rally.ui.notify.Notifier.showError({message: "Export is not supported "});
        }

    },
    createObjectURL: function ( file ) {
        if ( window.webkitURL ) {
            return window.webkitURL.createObjectURL( file );
        } else if ( window.URL && window.URL.createObjectURL ) {
            return window.URL.createObjectURL( file );
        } else {
            return null;
        }
    },
    destroyClickedElement: function(event)
    {
        document.body.removeChild(event.target);
    },
    fetchExportData: function(rootModel, rootFilters, fetch, columns){
        var deferred = Ext.create('Deft.Deferred');
        var rootFetch = Ext.Array.merge(fetch, Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.getPortfolioItemFetch());
        var me = this;


        var loader = Ext.create('Rally.apps.portfolioitemcosttracking.RollupDataLoader',{
              portfolioItemTypes: Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.getPortfolioItemTypes(),
              featureName: Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.getFeatureName(),
              listeners: {
                rollupdataloaded: function(portfolioHash, stories){
                    //onsole.log('rollupdataloaded', portfolioHash, stories);
                    var rollupData = Ext.create('Rally.apps.portfolioitemcosttracking.RollupCalculator', {
                        portfolioItemType: rootModel
                    });

                    rollupData.addRollupRecords(portfolioHash, stories);
                    //onsole.log('models updateded', portfolioHash, stories);
                    var exportData = me._getExportableRollupData(portfolioHash[rootModel.toLowerCase()],columns, rollupData);
                    columns = me._getAncestorTypeColumns(rootModel).concat(columns);

                    var csv = me._transformExportableRollupDataToDelimitedString(exportData, columns);
                    this.fireEvent('statusupdate', null);
                    deferred.resolve(csv);
                },
                loaderror: function(msg){
                    deferred.reject(msg);
                },
                statusupdate: function(status){
                    this.fireEvent('statusupdate', status);
                },
                scope: this
            }
        });
        loader.loadTree({model: rootModel, fetch: rootFetch, filters: rootFilters || []});

        return deferred;
    },
    _transformExportableRollupDataToDelimitedString: function(rollupData, columns){
        var csvArray = [],
            delimiter = ",",
            rowDelimiter = "\r\n",
            re = new RegExp(delimiter + '|\"|\r|\n','g');

        var column_keys = _.map(columns, function(c){ return c.costField || c.dataIndex; }),
            column_headers = _.pluck(columns, 'text');

        csvArray.push(column_headers.join(delimiter));

        Ext.Array.each(rollupData, function(obj){
            var data = [];
            Ext.Array.each(column_keys, function(key){
                var val = obj[key];
                if (val){
                    if (re.test(val)){ //enclose in double quotes if we have the delimiters
                        val = val.replace('"','\"\"');
                        val = Ext.String.format("\"{0}\"",val);
                    }
                }
               data.push(val);
            });
            csvArray.push(data.join(delimiter));
        });

        return csvArray.join(rowDelimiter);
    },
    /**
     * Returns an array of hash rollup data
     *
     * @param rootObjectIDs
     * @param columns - the data index of the columns that we want to export.
     * @param rollupData
     * @returns {Array}
     * @private
     */
    _getExportableRollupData: function(records, columns, rollupData){

        var exportData = [],
            me = this;


        _.each(records, function(r){
            var obj = rollupData.getRollupData(r);
            if (obj){
                var ancestors = {};
                var rec = obj.getExportRow(columns, ancestors);
                exportData.push(rec);
                me._addExportChildren(obj,exportData, columns, rollupData,ancestors);
            }
        }, this);
        return exportData;
    },
    _addExportChildren: function(obj, exportData, columns, rollupData,ancestors){
        var new_ancestors = Ext.clone(ancestors),
            me = this;
        new_ancestors[obj._type] = obj.FormattedID;

        var children = obj.children;
        if (children && children.length > 0){
            _.each(children, function(c){
                var row = c.getExportRow(columns, new_ancestors);
                exportData.push(row);
                me._addExportChildren(c, exportData, columns, rollupData, new_ancestors);
            }, this);
        }
        return;
    },
    _getAncestorTypeColumns: function(rootModel){
        var piTypes = Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.getPortfolioItemTypeObjects(),
            piIdx = -1;

        Ext.Array.each(piTypes, function(piObj, idx){
            if (piObj.typePath.toLowerCase() === rootModel.toLowerCase()){
                piIdx = idx;
            }
        });

        var columns = [{
            dataIndex: 'hierarchicalrequirement',
            text: 'User Story'
        }];

        if (piIdx >= 0){
            columns = columns.concat(Ext.Array.map(piTypes.slice(0,piIdx+1), function(piObj) { return { dataIndex: piObj.typePath.toLowerCase(), text: piObj.name };} ));
            columns.push({
                dataIndex: 'type',
                text: 'Artifact Type'
            });
            columns.reverse();
        }
        return columns;
    },
    fetchWsapiRecords: function(model, query_filters, fetch_fields, context){
        var deferred = Ext.create('Deft.Deferred');

        Ext.create('Rally.data.wsapi.Store',{
            model: model,
            fetch: fetch_fields,
            filters: query_filters,
            context: context,
            limit: Infinity
        }).load({
            callback: function(records, operation, success){
                if (success){
                    deferred.resolve(records);
                } else {
                    deferred.reject(Ext.String.format("Error getting {0} for {1}: {2}", model, query_filters.toString(), operation.error.errors.join(',')));
                }
            }
        });
        return deferred;
    }
});

