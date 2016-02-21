Ext = window.Ext4 || window.Ext

Ext.require [
  'Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings',
  'Rally.apps.portfolioitemcosttracking.CostPerProjectSettings',
  'Rally.apps.portfolioitemcosttracking.ProjectPickerDialog',
  'Rally.apps.portfolioitemcosttracking.NumberFieldComboBox'
]

describe 'Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings', ->
  helpers
    createSettings: (settings={}, contextValues) ->
      settingsReady = @stub()

      context = @_getContext contextValues
      @container = Ext.create 'Rally.app.AppSettings',
        renderTo: 'testDiv'
        context: context
        fields: Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.getFields settings
        listeners:
          appsettingsready: settingsReady

      @waitForCallback settingsReady

    _getContext: (context) ->
      Ext.create 'Rally.app.Context',
        initialValues: Ext.apply
          project:
            _ref: '/project/1'
            Name: 'Project 1'
          workspace:
            WorkspaceConfiguration:
              DragDropRankingEnabled: true
        , context

    _getFieldAt: (index) -> @container.down('form').form.getFields().getAt index

    _getCurrencyField: -> @_getFieldAt(0)
    _getPreliminaryBudgetField: -> @_getFieldAt(1)
    _getCalculationTypeSettingField: -> @_getFieldAt(2)
    _getNormalizedCostPerProjectField: -> @_getFieldAt(6)
    _getCostPerProjectField: -> @_getFieldAt(7)

    afterEach ->
      @container?.destroy()

    describe 'it creates the settings controls correctly', ->

      it 'displays the preliminary budget dropdown', ->
        @createSettings().then =>

          pbCombo = @_getPreliminaryBudgetField()
          types = Ext.Array.map pbCombo.getStore().getRange(), (record) ->
            record.get pbCombo.displayField

          expect(types.length).toBe 2
          expect(types[0]).toBe 'Preliminary Estimate'
          expect(types[1]).toBe 'Refined Estimate'


      it 'displays the currency dropdown', ->

        @createSettings().then =>

          currencyCombo = @_getCurrencyField()
          types = Ext.Array.map currencyCombo.getStore().getRange(), (record) ->
            record.get currencyCombo.displayField

          expect(types.length).toBe Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.currencyData.length

          i = 0
          while i < types.length
            expect(types[i]).toBe Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.currencyData[i].name
            i++

      it 'displays the calculation type settings control', ->

        @createSettings().then =>

          calcType = @_getCalculationTypeSettingField()
          expect(calcType.items.items.length).toBe _.keys(Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.calculationTypes).length

          settingsCalcTypeKeys = _.keys(Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.calculationTypes)

          i = 0
          while i < calcType.items.items.length
            expect(calcType.items.items[i].inputValue).toBe Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.calculationTypes[settingsCalcTypeKeys[i]].key
            expect(calcType.items.items[i].boxLabel).toBe Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.calculationTypes[settingsCalcTypeKeys[i]].label
            i++

      it 'returns the expected defaults', ->

        @createSettings(
            normalizedCostPerUnit: 1000,
            currencySign: '$',
            preliminaryBudgetField: 'PreliminaryEstimate',
            projectCostPerUnit: {'/project/1': 234}
          ).then =>

            expect(@_getPreliminaryBudgetField().getValue()).toBe 'PreliminaryEstimate'
            expect(@_getCurrencyField().getValue()).toBe '$'
            expect(@_getCalculationTypeSettingField().getValue().selectedCalculationType).toBe 'points'
            expect(Number(@_getNormalizedCostPerProjectField().getValue())).toBe 1000
            expect(@_getCostPerProjectField()._value['/project/1']).toBe 234
