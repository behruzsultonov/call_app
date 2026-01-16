# ContactInfoScreen Back Button Update

## Change Summary
Updated the Header component usage in ContactInfoScreen.js to properly implement the back button functionality.

## Change Made

### Corrected Prop Name
- Changed `onBackPress` to `onBack` to match the Header component's expected prop name
- The Header component checks for an `onBack` prop to determine whether to display the back button
- When `onBack` is provided, the Header component automatically renders a back button with the arrow-back icon

## Result
- Back button is now properly displayed in the ContactInfoScreen header
- Back button functionality works as expected, navigating back when pressed
- Consistent with other screens using the Header component
- Maintains the same styling and positioning as other screens in the app

## Verification
The Header component in Header.js has the following logic:
- Lines 49-55: Checks if `onBack` prop exists
- If it exists, renders a TouchableOpacity with arrow-back icon
- If not, renders an empty placeholder View to maintain layout consistency