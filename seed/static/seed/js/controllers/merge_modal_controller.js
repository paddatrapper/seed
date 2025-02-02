/**
 * :copyright (c) 2014 - 2019, The Regents of the University of California, through Lawrence Berkeley National Laboratory (subject to receipt of any required approvals from the U.S. Department of Energy) and contributors. All rights reserved.
 * :author
 */
angular.module('BE.seed.controller.merge_modal', [])
  .controller('merge_modal_controller', [
    '$scope',
    '$log',
    'matching_service',
    '$uibModalInstance',
    'Notification',
    'spinner_utility',
    'uiGridConstants',
    'naturalSort',
    'columns',
    'data',
    'inventory_type',
    'has_meters',
    function ($scope, $log, matching_service, $uibModalInstance, Notification, spinner_utility, uiGridConstants, naturalSort, columns, data, inventory_type, has_meters) {
      spinner_utility.hide();

      $scope.inventory_type = inventory_type;
      $scope.data = data;
      $scope.result = [{}];
      $scope.processing = false;
      $scope.has_meters = has_meters;

      // Columns
      $scope.columns = columns;
      $scope.protectedColumns = _.map(_.filter(columns, {merge_protection: 'Favor Existing'}), 'name');
      var defaults = {
        headerCellFilter: 'translate',
        headerCellTemplate: 'ui-grid/seedMergeHeader',
        minWidth: 75,
        width: 150
      };
      _.map($scope.columns, function (col) {
        return _.defaults(col, defaults);
      });

      var notEmpty = function (value, key) {
        return !_.isNil(value) && value !== '' && !_.includes(['$$hashKey', '$$treeLevel'], key);
      };

      var updateResult = function () {
        var cleanedData = _.map($scope.data, function (datum) {
          return _.pickBy(datum, notEmpty);
        });
        $scope.result[0] = _.defaults.apply(null, cleanedData);

        // Handle Merge Protection columns
        _.forEach($scope.protectedColumns, function (col) {
          $scope.result[0][col] = _.last($scope.data)[col];
        });

        // Concatenate Jurisdiction Tax Lot IDs if inventory_type is property
        if ($scope.inventory_type === 'properties') {
          var jurisdiction_tax_lot_col = _.find($scope.columns, {
            column_name: 'jurisdiction_tax_lot_id',
            table_name: 'TaxLotState'
          });
          if (jurisdiction_tax_lot_col) {
            var values = [];
            _.forEach(cleanedData, function (datum) {
              values = values.concat(_.split(datum[jurisdiction_tax_lot_col.name], '; '));
            });
            var cleanedValues = _.uniq(_.without(values, undefined, null, ''));
            $scope.result[0][jurisdiction_tax_lot_col.name] = _.join(cleanedValues.sort(naturalSort), '; ');
          }
        }
      };
      updateResult();

      var determineHiddenColumns = function () {
        var visibleColumns = _.keys($scope.result[0]);
        _.forEach($scope.columns, function (col) {
          if (!_.includes(visibleColumns, col.name)) {
            col.visible = false;
          }
        });
      };
      determineHiddenColumns();

      var reverseOrder = function () {
        $scope.data.reverse();
        updateResult();
      };

      $scope.merge = function () {
        $scope.processing = true;
        var state_ids;
        if ($scope.inventory_type === 'properties') {
          state_ids = _.map($scope.data, 'property_state_id').reverse();
          return matching_service.mergeProperties(state_ids).then(function (data) {
            Notification.success('Successfully merged ' + state_ids.length + ' properties');
            if (_.has(data, 'match_merged_count')) {
              var otherMergedRecords = data.match_merged_count - 1;
              Notification.info({
                message: otherMergedRecords === 1 ? '1 other record was matched and merged.' : otherMergedRecords + ' other records were matched and merged.',
                delay: 10000
              });
            }
            $scope.close();
          }, function (err) {
            $log.error(err);
            Notification.error('Failed to merge properties');
          }).finally(function () {
            $scope.processing = false;
          });
        } else {
          state_ids = _.map($scope.data, 'taxlot_state_id').reverse();
          return matching_service.mergeTaxlots(state_ids).then(function (data) {
            Notification.success('Successfully merged ' + state_ids.length + ' tax lots');
            if (_.has(data, 'match_merged_count')) {
              var otherMergedRecords = data.match_merged_count - 1;
              Notification.info({
                message: otherMergedRecords === 1 ? '1 other record was matched and merged.' : otherMergedRecords + ' other records were matched and merged.',
                delay: 10000
              });
            }
            $scope.close();
          }, function (err) {
            $log.error(err);
            Notification.error('Failed to merge tax lots');
          }).finally(function () {
            $scope.processing = false;
          });
        }
      };

      $scope.resultingGridOptions = {
        data: 'result',
        enableColumnMenus: false,
        enableGridMenu: false,
        enableSorting: false,
        enableVerticalScrollbar: uiGridConstants.scrollbars.NEVER,
        flatEntityAccess: true,
        minRowsToShow: 1,
        columnDefs: $scope.columns
      };

      $scope.gridOptions = {
        data: 'data',
        enableColumnMenus: false,
        enableGridMenu: true,
        enableSorting: false,
        flatEntityAccess: true,
        gridMenuCustomItems: [{
          title: 'Reverse order',
          action: reverseOrder
        }],
        gridMenuShowHideColumns: false,
        rowTemplate: '<div grid="grid" class="ui-grid-draggable-row" draggable="true"><div ng-repeat="(colRenderIndex, col) in colContainer.renderedColumns track by col.colDef.name" class="ui-grid-cell" ng-class="{ \'ui-grid-row-header-cell\': col.isRowHeader, \'custom\': true }" ui-grid-cell></div></div>',
        columnDefs: $scope.columns,
        onRegisterApi: function (gridApi) {
          $scope.gridApi = gridApi;

          gridApi.draggableRows.on.rowDropped($scope, updateResult);
        }
      };
      if (data.length < 10) $scope.gridOptions.minRowsToShow = data.length;

      $scope.close = function () {
        $uibModalInstance.close();
      };

      $scope.cancel = function () {
        $uibModalInstance.dismiss();
      };
    }]);
