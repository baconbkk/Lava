angular.module(primaryApplicationName).controller('CtrlMailDetail', function($scope, $timeout, inbox, consts) {
	$scope.isLoading = false;
	$scope.selectedTid = null;
	$scope.emails = [];

	var selectionChangedTimeout = null;

	$scope.$on('inbox-selection-changed', (e, selectedTid) => {
		selectionChangedTimeout = $timeout.schedule(selectionChangedTimeout, () => {
			$scope.selectedTid = selectedTid;

			if (selectedTid !== null) {
				$scope.isLoading = true;
				$scope.emails = [];
				inbox.getEmailsByThreadId(selectedTid)
					.then(emails => {
						$scope.emails = emails;
					})
					.finally(() => {
						$scope.isLoading = false;
					});
			}
		}, consts.FAST_ACTIONS_TIMEOUT);
	});
});
