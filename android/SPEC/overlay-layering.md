# Overlay layering rule

All application bottom sheets must be rendered through `CompasBottomSheet`.

`CompasBottomSheet` is hosted in a full-screen Compose `Dialog`, so the modal scrim and sheet surface always render above the floating navigation dock. This also prevents the dock from intercepting taps intended for sheet controls.

The sheet applies navigation-bar and IME insets. Custom screen-local bottom overlays must not be used for modal actions.
