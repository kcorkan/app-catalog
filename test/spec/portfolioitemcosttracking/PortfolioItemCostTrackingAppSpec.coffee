Ext = window.Ext4 || window.Ext
Ext.require [
  'Rally.data.util.PortfolioItemHelper',
#  "Rally.apps.common.PortfolioItemsGridBoardApp",
#  "Rally.apps.portfolioitemcosttracking.CostPerProjectSettings",
  "Rally.apps.portfolioitemcosttracking.CostTemplateColumn",
#  "Rally.apps.portfolioitemcosttracking.Exporter",
#  "Rally.apps.portfolioitemcosttracking.RollupItem",
#  "Rally.apps.portfolioitemcosttracking.LowestLevelPortfolioRollupItem",
#  "Rally.apps.portfolioitemcosttracking.NumberFieldComboBox",
  "Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingApp",
  "Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings",
#  "Rally.apps.portfolioitemcosttracking.ProjectPickerDialog",
  "Rally.apps.portfolioitemcosttracking.RollupCalculator",
#  "Rally.apps.portfolioitemcosttracking.RollupDataLoader",
#  "Rally.apps.portfolioitemcosttracking.UpperLevelPortfolioRollupItem",
#  "Rally.apps.portfolioitemcosttracking.UserStoryRollupItem"
], ->
describe 'Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingAppSpec', ->
  helpers
    getExtContext: () ->
      Ext.create 'Rally.app.Context',
        initialValues:
          project: Rally.environment.getContext().getProject()
          workspace: Rally.environment.getContext().getWorkspace()
          user: Rally.environment.getContext().getUser()


    createApp: (config = {}) ->
      Ext.create 'Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingApp',
        Ext.apply
          context: @getExtContext()
          renderTo: 'testDiv'
        , config

    renderApp: (config) ->
      @app = @createApp(config)
      @waitForComponentReady @app

    changeType: ->
      addGridBoardSpy = @spy @app, 'addGridBoard'
      @app.piTypePicker.setValue(Rally.util.Ref.getRelativeUri(@piHelper.theme._ref))
      @waitForCallback addGridBoardSpy

  beforeEach ->
    @piHelper = new Helpers.PortfolioItemGridBoardHelper @
    @piHelper.stubPortfolioItemRequests()

  afterEach ->
    @app?.destroy()

  describe 'PI type picker ', ->
    it 'should render to the left in the grid header always', ->
        @renderApp({}).then =>
          expect(@app.gridboard.getHeader?().getLeft?().contains?(@app.piTypePicker)).toBeTruthy()

      describe "in grid mode", ->
        beforeEach ->
          @renderApp toggleState: 'grid'

        describe 'on type change', ->
          it 'should trigger modeltypeschange event when selection changes', ->
            modelChangeStub = @stub()
            @app.gridboard.on('modeltypeschange', modelChangeStub)
            @changeType().then =>
              expect(modelChangeStub).toHaveBeenCalledOnce()

          it 'should load a new gridboard when selection changes', ->
            @changeType().then =>
              expect(@app.gridboard.modelNames).toEqual [@piHelper.theme.TypePath]

          it 'should not destroy the type picker', ->
            typePicker = @app.piTypePicker
            destroyStub = @stub()
            typePicker.on 'destroy', destroyStub

            @changeType().then =>
              expect(typePicker.isVisible()).toBe true
              expect(destroyStub).not.toHaveBeenCalled()
              expect(@app.piTypePicker).toBe typePicker

    describe 'rollup calculator', ->
      it 'should create a rollup calculator with the selected portfolio item type', ->
        @renderApp({}).then =>
          @changeType().then =>
            expect(@app.rollupData.portfolioItemType.toLowerCase()).toBe('portfolioitem/theme')