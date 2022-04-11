/**
 * External dependencies
 */
import classnames from 'classnames';
import { has, get } from 'lodash';

/**
 * WordPress dependencies
 */
import { createHigherOrderComponent, useInstanceId } from '@wordpress/compose';
import { addFilter } from '@wordpress/hooks';
import { getBlockSupport, hasBlockSupport } from '@wordpress/blocks';
import { useSelect } from '@wordpress/data';
import {
	Button,
	ButtonGroup,
	ToggleControl,
	PanelBody,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useContext, createPortal } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { store as blockEditorStore } from '../store';
import { InspectorControls } from '../components';
import useSetting from '../components/use-setting';
import { LayoutStyle } from '../components/block-list/layout';
import BlockList from '../components/block-list';
import { getLayoutType, getLayoutTypes } from '../layouts';

const layoutBlockSupportKey = '__experimentalLayout';

function LayoutPanel( { setAttributes, attributes, name: blockName } ) {
	const { layout } = attributes;

	const { supportsFlowLayout, config } = useLayout( blockName );
	const {
		allowSwitching,
		allowEditing = true,
		allowInheriting = true,
		default: defaultBlockLayout,
	} = config;

	if ( ! allowEditing ) {
		return null;
	}

	// Only show the inherit toggle if it's supported,
	// a default theme layout is set (e.g. one that provides `contentSize` and/or `wideSize` values),
	// and that the default / flow layout type is in use, as this is the only one that supports inheritance.
	const showInheritToggle = !! (
		allowInheriting &&
		!! supportsFlowLayout &&
		( ! layout?.type || layout?.type === 'default' || layout?.inherit )
	);

	const usedLayout = layout || defaultBlockLayout || {};
	const { inherit = false, type = 'default' } = usedLayout;

	if ( type === 'default' && ! supportsFlowLayout ) {
		return null;
	}
	const layoutType = getLayoutType( type );

	const onChangeType = ( newType ) =>
		setAttributes( { layout: { type: newType } } );
	const onChangeLayout = ( newLayout ) =>
		setAttributes( { layout: newLayout } );

	return (
		<>
			<InspectorControls>
				<PanelBody title={ __( 'Layout' ) }>
					{ showInheritToggle && (
						<ToggleControl
							label={ __( 'Inherit default layout' ) }
							checked={ !! inherit }
							onChange={ () =>
								setAttributes( {
									layout: { inherit: ! inherit },
								} )
							}
						/>
					) }

					{ ! inherit && allowSwitching && (
						<LayoutTypeSwitcher
							type={ type }
							onChange={ onChangeType }
						/>
					) }

					{ ! inherit && layoutType && (
						<layoutType.inspectorControls
							layout={ usedLayout }
							onChange={ onChangeLayout }
							layoutBlockSupport={ config }
						/>
					) }
				</PanelBody>
			</InspectorControls>
			{ ! inherit && layoutType && (
				<layoutType.toolBarControls
					layout={ usedLayout }
					onChange={ onChangeLayout }
					layoutBlockSupport={ config }
				/>
			) }
		</>
	);
}

function LayoutTypeSwitcher( { type, onChange } ) {
	return (
		<ButtonGroup>
			{ getLayoutTypes().map( ( { name, label } ) => {
				return (
					<Button
						key={ name }
						isPressed={ type === name }
						onClick={ () => onChange( name ) }
					>
						{ label }
					</Button>
				);
			} ) }
		</ButtonGroup>
	);
}

export function useLayout( blockName ) {
	const defaultThemeLayout = useSetting( 'layout' );
	const themeSupportsLayout = useSelect( ( select ) => {
		const { getSettings } = select( blockEditorStore );
		return getSettings().supportsLayout;
	}, [] );

	const layoutBlockSupport = getBlockSupport(
		blockName,
		layoutBlockSupportKey,
		{}
	);

	return {
		supportsFlowLayout: themeSupportsLayout,
		defaultLayout: defaultThemeLayout,
		config: layoutBlockSupport,
	};
}

/**
 * Filters registered block settings, extending attributes to include `layout`.
 *
 * @param {Object} settings Original block settings.
 *
 * @return {Object} Filtered block settings.
 */
export function addAttribute( settings ) {
	if ( has( settings.attributes, [ 'layout', 'type' ] ) ) {
		return settings;
	}
	if ( hasBlockSupport( settings, layoutBlockSupportKey ) ) {
		settings.attributes = {
			...settings.attributes,
			layout: {
				type: 'object',
			},
		};
	}

	return settings;
}

/**
 * Override the default edit UI to include layout controls
 *
 * @param {Function} BlockEdit Original component.
 *
 * @return {Function} Wrapped component.
 */
export const withInspectorControls = createHigherOrderComponent(
	( BlockEdit ) => ( props ) => {
		const { name: blockName } = props;
		const supportLayout = hasBlockSupport(
			blockName,
			layoutBlockSupportKey
		);

		return [
			supportLayout && <LayoutPanel key="layout" { ...props } />,
			<BlockEdit key="edit" { ...props } />,
		];
	},
	'withInspectorControls'
);

/**
 * Override the default block element to add the layout styles.
 *
 * @param {Function} BlockListBlock Original component.
 *
 * @return {Function} Wrapped component.
 */
export const withLayoutStyles = createHigherOrderComponent(
	( BlockListBlock ) => ( props ) => {
		const { name, attributes } = props;
		const shouldRenderLayoutStyles = hasBlockSupport(
			name,
			layoutBlockSupportKey
		);
		const id = useInstanceId( BlockListBlock );
		const defaultThemeLayout = useSetting( 'layout' ) || {};
		const element = useContext( BlockList.__unstableElementContext );
		const { layout } = attributes;
		const { default: defaultBlockLayout } =
			getBlockSupport( name, layoutBlockSupportKey ) || {};
		const usedLayout = layout?.inherit
			? defaultThemeLayout
			: layout || defaultBlockLayout || {};
		const padding = layout?.inherit
			? usedLayout?.padding
			: get( attributes, [ 'style', 'spacing', 'padding' ] );
		const className = classnames( props?.className, {
			[ `wp-container-${ id }` ]: shouldRenderLayoutStyles,
		} );

		return (
			<>
				{ shouldRenderLayoutStyles &&
					element &&
					createPortal(
						<LayoutStyle
							blockName={ name }
							selector={ `.wp-container-${ id }` }
							layout={ usedLayout }
							padding={ padding }
							style={ attributes?.style }
						/>,
						element
					) }
				<BlockListBlock { ...props } className={ className } />
			</>
		);
	}
);

addFilter(
	'blocks.registerBlockType',
	'core/layout/addAttribute',
	addAttribute
);
addFilter(
	'editor.BlockListBlock',
	'core/editor/layout/with-layout-styles',
	withLayoutStyles
);
addFilter(
	'editor.BlockEdit',
	'core/editor/layout/with-inspector-controls',
	withInspectorControls
);
