Ext = window.Ext4 || window.Ext
Ext.require [
  'Rally.apps.portfolioitemcosttracking.RollupCalculator',
  'Rally.apps.portfolioitemcosttracking.RollupItem',
  'Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings',
  'Rally.apps.portfolioitemcosttracking.UpperLevelPortfolioRollupItem',
  'Rally.apps.portfolioitemcosttracking.LowestLevelPortfolioRollupItem',
  'Rally.apps.portfolioitemcosttracking.UserStoryRollupItem'
], ->
describe 'Rally.apps.portfolioitemcosttracking.RollupCalculatorSpec', ->
  helpers

    initializeSettings: (preliminaryBudgetField, calculationType, projectCostPerUnit) ->
      Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.notAvailableText = "--"
      Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.currencySign = "$"
      Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.currencyPrecision = 0
      Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.currencyEnd = false

      Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.completedScheduleStates = ['Accepted','Released']
      Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.normalizedCostPerUnit = 1000

      Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.projectCostPerUnit = projectCostPerUnit
      Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.preliminaryBudgetField = preliminaryBudgetField
      Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.setCalculationType(calculationType)

      Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.portfolioItemTypes = [
        {
          typePath: 'portfolioitem/feature'
          name: 'Feature'
          ordinal: 0
        }
        {
          typePath: 'portfolioitem/initiative'
          name: 'Initiative'
          ordinal: 1
        }
        {
          typePath: 'portfolioitem/theme'
          name: 'Theme'
          ordinal: 2
        }
      ]

    createRollupCalculator: (selectedPortfolioTypePath) ->
      Ext.create('Rally.apps.portfolioitemcosttracking.RollupCalculator',{
        portfolioItemType: selectedPortfolioTypePath
      })

    createUserStory: (objectID, projectID, scheduleState, portfolioItemID, planEstimate, taskActualTotal, taskRemainingTotal) ->
      Ext.create Rally.test.mock.data.WsapiModelFactory.getUserStoryModel(),
        _ref: '/hierarchicalrequirement/' + objectID
        Name: 'US ' + objectID,
        ObjectID: objectID,
        Project: { _ref: '/project/' + projectID || 100 },
        ScheduleState: scheduleState,
        PortfolioItem: { ObjectID: portfolioItemID },
        PlanEstimate: planEstimate,
        TaskActualTotal: taskActualTotal,
        TaskRemainingTotal: taskRemainingTotal

    createPortfolioItem: (type, objectID, projectID, parent, preliminaryEstimate, refinedEstimate) ->
      if preliminaryEstimate
        preliminaryEstimate = Value: preliminaryEstimate

      if parent
        parent = ObjectID: parent

      fn = 'getPortfolioItemFeatureModel'
      if type == 'theme'
        fn = 'getPortfolioItemThemeModel'
      if type == 'initiative'
        fn = 'getPortfolioItemInitiativeModel'

      Ext.create Rally.test.mock.data.WsapiModelFactory[fn](),
        _ref: '/portfolioitem/' + type + '/' + objectID
        Name: type + objectID,
        Project: { _ref: '/project/' + projectID || 100  },
        ObjectID: objectID,
        PreliminaryEstimate: preliminaryEstimate,
        RefinedEstimate: refinedEstimate,
        Parent: parent


    createThemeTestRecords: () ->
      [
        @createPortfolioItem('theme',1,100,null,50,40)
        @createPortfolioItem('theme',2,100,null,15,14)
        @createPortfolioItem('theme',3,101,null,5,4)
      ]

    createInitiativeTestRecords: () ->
      [
        @createPortfolioItem('initiative',4,100,1,30,29)
        @createPortfolioItem('initiative',5,100,1,13,12)
        @createPortfolioItem('initiative',6,101,2,2,3)
      ]
    createFeatureTestRecords:  ->
      [
        @createPortfolioItem('feature',7,100,4,16,17)
        @createPortfolioItem('feature',8,200,4,26,27)
        @createPortfolioItem('feature',9,100,5,6)
      ]
    createStoryTestRecords: ->
      [
        @createUserStory(10,101,"Accepted",7,5,0,0)
        @createUserStory(11,200,"Released",9,8,0,0)
        @createUserStory(12,100,"Defined",7,3,0,0)
        @createUserStory(13,101,"Defined",9,3,0,0)
      ]

  afterEach ->
    @calculator?.destroy()

  describe 'rollup items', ->
    it 'UserStoryRollupItem initializes when calculation type is points', ->
      @initializeSettings('PreliminaryEstimate','points',{ "/project/200": 500 })
      totalFn = Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.getCalculationTypeSettings().totalUnitsForStoryFn
      actualFn = Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.getCalculationTypeSettings().actualUnitsForStoryFn

      story = @createUserStory(1,200,"Defined",2,13,0,0,0)
      userStoryRollup = Ext.create 'Rally.apps.portfolioitemcosttracking.UserStoryRollupItem', story, totalFn, actualFn
      expect(userStoryRollup.__totalUnits).toBe 13
      expect(userStoryRollup.__actualUnits).toBe 0
      expect(userStoryRollup._notEstimated).toBe false
      expect(userStoryRollup._rollupDataTotalCost).toBe 6500
      expect(userStoryRollup._rollupDataActualCost).toBe 0
      expect(userStoryRollup._rollupDataRemainingCost).toBe 6500
      expect(userStoryRollup.parent).toBe 2
      expect(userStoryRollup.objectID).toBe 1
      expect(userStoryRollup._rollupDataPreliminaryBudget).toBe null

      story = @createUserStory(1,100,"Released",2,8,0,0,0)
      userStoryRollup = Ext.create 'Rally.apps.portfolioitemcosttracking.UserStoryRollupItem', story, totalFn, actualFn
      expect(userStoryRollup.__totalUnits).toBe 8
      expect(userStoryRollup.__actualUnits).toBe 8
      expect(userStoryRollup._notEstimated).toBe false
      expect(userStoryRollup._rollupDataTotalCost).toBe 8000
      expect(userStoryRollup._rollupDataActualCost).toBe 8000
      expect(userStoryRollup._rollupDataRemainingCost).toBe 0
      expect(userStoryRollup.parent).toBe 2
      expect(userStoryRollup.objectID).toBe 1
      expect(userStoryRollup._rollupDataPreliminaryBudget).toBe null

    it 'UserStoryRollupItem initializes when calculation type is taskHours', ->
      @initializeSettings('PreliminaryEstimate','taskHours',{ "/project/200": 2000 })
      totalFn = Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.getCalculationTypeSettings().totalUnitsForStoryFn
      actualFn = Rally.apps.portfolioitemcosttracking.PortfolioItemCostTrackingSettings.getCalculationTypeSettings().actualUnitsForStoryFn

      story = @createUserStory(1,200,"Defined",2,13,5,4)
      userStoryRollup = Ext.create 'Rally.apps.portfolioitemcosttracking.UserStoryRollupItem', story, totalFn, actualFn
      expect(userStoryRollup.__totalUnits).toBe 9
      expect(userStoryRollup.__actualUnits).toBe 5
      expect(userStoryRollup._notEstimated).toBe false
      expect(userStoryRollup._rollupDataTotalCost).toBe 18000
      expect(userStoryRollup._rollupDataActualCost).toBe 10000
      expect(userStoryRollup._rollupDataRemainingCost).toBe 8000
      expect(userStoryRollup.parent).toBe 2
      expect(userStoryRollup.objectID).toBe 1
      expect(userStoryRollup._rollupDataPreliminaryBudget).toBe null

      story = @createUserStory(1,100,"Released",2,8,0,2)
      userStoryRollup = Ext.create 'Rally.apps.portfolioitemcosttracking.UserStoryRollupItem', story, totalFn, actualFn
      expect(userStoryRollup.__totalUnits).toBe 2
      expect(userStoryRollup.__actualUnits).toBe 0
      expect(userStoryRollup._notEstimated).toBe false
      expect(userStoryRollup._rollupDataTotalCost).toBe 2000
      expect(userStoryRollup._rollupDataActualCost).toBe 0
      expect(userStoryRollup._rollupDataRemainingCost).toBe 2000
      expect(userStoryRollup.parent).toBe 2
      expect(userStoryRollup.objectID).toBe 1
      expect(userStoryRollup._rollupDataPreliminaryBudget).toBe null

    it 'LowestLevelPortfolioRollupItem initializes when preliminary budget field is PreliminaryEstimate', ->
      @initializeSettings('PreliminaryEstimate','points',{ "/project/200": 500 })

      feature = @createPortfolioItem('feature',1,200,2,9,0)
      rollupItem = Ext.create 'Rally.apps.portfolioitemcosttracking.LowestLevelPortfolioRollupItem', feature
      expect(rollupItem._notEstimated).toBe true
      expect(rollupItem._rollupDataTotalCost).toBe 4500
      expect(rollupItem._rollupDataActualCost).toBe 0
      expect(rollupItem._rollupDataRemainingCost).toBe 4500
      expect(rollupItem.parent).toBe 2
      expect(rollupItem.objectID).toBe 1
      expect(rollupItem._rollupDataPreliminaryBudget).toBe 4500

      feature = @createPortfolioItem('feature',1,200,2,null,null)
      rollupItem = Ext.create 'Rally.apps.portfolioitemcosttracking.LowestLevelPortfolioRollupItem', feature
      expect(rollupItem._notEstimated).toBe true
      expect(rollupItem._rollupDataTotalCost).toBe 0
      expect(rollupItem._rollupDataActualCost).toBe 0
      expect(rollupItem._rollupDataRemainingCost).toBe 0
      expect(rollupItem.parent).toBe 2
      expect(rollupItem.objectID).toBe 1
      expect(rollupItem._rollupDataPreliminaryBudget).toBe null


    it 'LowestLevelPortfolioRollupItem initializes when preliminary budget field is RefinedEstimate', ->
      @initializeSettings('RefinedEstimate','points',{ "/project/200": 2000 })

      feature = @createPortfolioItem('feature',1,200,2,0,9)
      rollupItem = Ext.create 'Rally.apps.portfolioitemcosttracking.LowestLevelPortfolioRollupItem', feature
      expect(rollupItem._notEstimated).toBe true
      expect(rollupItem._rollupDataTotalCost).toBe 18000
      expect(rollupItem._rollupDataActualCost).toBe 0
      expect(rollupItem._rollupDataRemainingCost).toBe 18000
      expect(rollupItem.parent).toBe 2
      expect(rollupItem.objectID).toBe 1
      expect(rollupItem._rollupDataPreliminaryBudget).toBe 18000

      feature = @createPortfolioItem('feature',1,200,2,null,null)
      rollupItem = Ext.create 'Rally.apps.portfolioitemcosttracking.LowestLevelPortfolioRollupItem', feature
      expect(rollupItem._notEstimated).toBe true
      expect(rollupItem._rollupDataTotalCost).toBe 0
      expect(rollupItem._rollupDataActualCost).toBe 0
      expect(rollupItem._rollupDataRemainingCost).toBe 0
      expect(rollupItem.parent).toBe 2
      expect(rollupItem.objectID).toBe 1
      expect(rollupItem._rollupDataPreliminaryBudget).toBe null

  describe 'after records have been added to the calculator', ->
    it 'calculates the preliminary budget correctly when using the PreliminaryEstimate field for each portfolio item type', ->
      @initializeSettings('PreliminaryEstimate','points',{ "/project/200": 500 })
      @calculator = @createRollupCalculator('portfolioitem/theme')

      portfolioitems = {
        'portfolioitem/theme': @createThemeTestRecords()
        'portfolioitem/initiative': @createInitiativeTestRecords()
        'portfolioitem/feature': @createFeatureTestRecords()
      }

      stories = @createStoryTestRecords()

      @calculator.addRollupRecords(portfolioitems, stories)

      expect(@calculator.getRollupData({ ObjectID: 1 })._rollupDataPreliminaryBudget).toBe 50000
      expect(@calculator.getRollupData({ ObjectID: 2 })._rollupDataPreliminaryBudget).toBe 15000
      expect(@calculator.getRollupData({ ObjectID: 3 })._rollupDataPreliminaryBudget).toBe 5000

      expect(@calculator.getRollupData({ ObjectID: 4 })._rollupDataPreliminaryBudget).toBe 30000
      expect(@calculator.getRollupData({ ObjectID: 5 })._rollupDataPreliminaryBudget).toBe 13000
      expect(@calculator.getRollupData({ ObjectID: 6 })._rollupDataPreliminaryBudget).toBe 2000

      expect(@calculator.getRollupData({ ObjectID: 7 })._rollupDataPreliminaryBudget).toBe 16000
      expect(@calculator.getRollupData({ ObjectID: 8 })._rollupDataPreliminaryBudget).toBe 13000
      expect(@calculator.getRollupData({ ObjectID: 9 })._rollupDataPreliminaryBudget).toBe 6000

      expect(@calculator.getRollupData({ ObjectID: 10 })._rollupDataPreliminaryBudget).toBe null

    it 'calculates the preliminary budget correctly when using the RefinedEstimate field for each portfolio item type', ->
      @initializeSettings('RefinedEstimate','points',{ "/project/200": 2000 })
      @calculator = @createRollupCalculator('portfolioitem/theme')

      portfolioitems = {
        'portfolioitem/theme': @createThemeTestRecords()
        'portfolioitem/initiative': @createInitiativeTestRecords()
        'portfolioitem/feature': @createFeatureTestRecords()
      }

      stories = @createStoryTestRecords()

      @calculator.addRollupRecords(portfolioitems, stories)
      expect(@calculator.getRollupData({ ObjectID: 1 })._rollupDataPreliminaryBudget).toBe 40000
      expect(@calculator.getRollupData({ ObjectID: 2 })._rollupDataPreliminaryBudget).toBe 14000
      expect(@calculator.getRollupData({ ObjectID: 3 })._rollupDataPreliminaryBudget).toBe 4000

      expect(@calculator.getRollupData({ ObjectID: 4 })._rollupDataPreliminaryBudget).toBe 29000
      expect(@calculator.getRollupData({ ObjectID: 5 })._rollupDataPreliminaryBudget).toBe 12000
      expect(@calculator.getRollupData({ ObjectID: 6 })._rollupDataPreliminaryBudget).toBe 3000

      expect(@calculator.getRollupData({ ObjectID: 7 })._rollupDataPreliminaryBudget).toBe 17000
      expect(@calculator.getRollupData({ ObjectID: 8 })._rollupDataPreliminaryBudget).toBe 54000
      expect(@calculator.getRollupData({ ObjectID: 9 })._rollupDataPreliminaryBudget).toBe null

      expect(@calculator.getRollupData({ ObjectID: 10 })._rollupDataPreliminaryBudget).toBe null

    it 'calculates the total, actual and remaining cost correctly when using the points as the calculation type', ->

      @initializeSettings('RefinedEstimate','points',{ "/project/101": 2000, "/project/200": 100 })
      @calculator = @createRollupCalculator('portfolioitem/theme')

      portfolioitems = {
        'portfolioitem/theme': @createThemeTestRecords()
        'portfolioitem/initiative': @createInitiativeTestRecords()
        'portfolioitem/feature': @createFeatureTestRecords()
      }

      stories = @createStoryTestRecords()
      @calculator.addRollupRecords(portfolioitems, stories)

      expect(@calculator.getRollupData({ ObjectID: 1 })._rollupDataTotalCost).toBe 22500
      expect(@calculator.getRollupData({ ObjectID: 1 })._rollupDataActualCost).toBe 10800
      expect(@calculator.getRollupData({ ObjectID: 1 })._rollupDataRemainingCost).toBe 11700
      expect(@calculator.getRollupData({ ObjectID: 1 })._notEstimated).toBe false

      expect(@calculator.getRollupData({ ObjectID: 4 })._rollupDataTotalCost).toBe 15700
      expect(@calculator.getRollupData({ ObjectID: 4 })._rollupDataActualCost).toBe 10000
      expect(@calculator.getRollupData({ ObjectID: 4 })._rollupDataRemainingCost).toBe 5700
      expect(@calculator.getRollupData({ ObjectID: 4 })._notEstimated).toBe false

    it 'calculates the total, actual and remaining cost using the RefinedEstimate field for portfolio items that have no story data to rollup', ->

      @initializeSettings('RefinedEstimate','points',{ "/project/101": 2000 })
      @calculator = @createRollupCalculator('portfolioitem/theme')

      portfolioitems = {
        'portfolioitem/theme': @createThemeTestRecords()
        'portfolioitem/initiative': @createInitiativeTestRecords()
        'portfolioitem/feature': @createFeatureTestRecords()
      }

      @calculator.addRollupRecords(portfolioitems, [])

      expect(@calculator.getRollupData({ ObjectID: 2 })._rollupDataTotalCost).toBe 6000
      expect(@calculator.getRollupData({ ObjectID: 2 })._rollupDataActualCost).toBe 0
      expect(@calculator.getRollupData({ ObjectID: 2 })._rollupDataRemainingCost).toBe 6000
      expect(@calculator.getRollupData({ ObjectID: 2 })._notEstimated).toBe true

      expect(@calculator.getRollupData({ ObjectID: 3 })._rollupDataTotalCost).toBe 8000
      expect(@calculator.getRollupData({ ObjectID: 3 })._rollupDataActualCost).toBe 0
      expect(@calculator.getRollupData({ ObjectID: 3 })._rollupDataRemainingCost).toBe 8000
      expect(@calculator.getRollupData({ ObjectID: 3 })._notEstimated).toBe true

      expect(@calculator.getRollupData({ ObjectID: 8 })._rollupDataTotalCost).toBe 27000
      expect(@calculator.getRollupData({ ObjectID: 8 })._rollupDataActualCost).toBe 0
      expect(@calculator.getRollupData({ ObjectID: 8 })._rollupDataRemainingCost).toBe 27000
      expect(@calculator.getRollupData({ ObjectID: 8})._notEstimated).toBe true
