// Settings panel for demo.html. It changes the live cfg in src/main.js, so the preview is
// the screensaver itself, and writes the settings out as a config.js.

const CONTROLS = [
    { key: 'lineColor', label: 'Line colour', type: 'color' },
    { key: 'background', label: 'Background', type: 'color' },
    { key: 'wobble', label: 'Wobble', min: 0, max: 3, step: 0.1 },
    { key: 'boilRate', label: 'Boil rate', min: 4, max: 24, step: 1, unit: ' fps' },
    { key: 'lineWidth', label: 'Line width', min: 0.5, max: 12, step: 0.5, unit: ' px' },
    { key: 'drawSeconds', label: 'Draw', min: 0.5, max: 30, step: 0.5, unit: ' s', restart: true },
    { key: 'holdSeconds', label: 'Hold', min: 0, max: 60, step: 1, unit: ' s' },
    { key: 'wipeSeconds', label: 'Wipe', min: 0.2, max: 10, step: 0.1, unit: ' s' },
];

const panel = document.getElementById( 'panel' );
const showButton = document.getElementById( 'show' );
const output = document.getElementById( 'output' );

// The settings the page started with, from config.js and the query, and one function per
// control that sets it back from cfg.
const START = JSON.parse( JSON.stringify( cfg ) );
const syncs = [];

function buildControls()
{
    const box = document.getElementById( 'controls' );
    for ( const c of CONTROLS )
    {
        const row = document.createElement( 'div' );
        row.className = 'row';
        const id = 'c-' + c.key;
        const input = document.createElement( 'input' );
        input.id = id;
        input.type = c.type || 'range';
        if ( input.type === 'range' )
            Object.assign( input, { min: c.min, max: c.max, step: c.step } );
        input.value = cfg[c.key];

        const label = document.createElement( 'label' );
        label.htmlFor = id;
        label.textContent = c.label;
        row.append( label );

        const value = document.createElement( 'output' );
        const show = () => value.textContent = c.type ? '' : input.value + ( c.unit || '' );
        show();
        syncs.push( () =>
        {
            input.value = cfg[c.key];
            show();
        } );

        input.addEventListener( 'input', () =>
        {
            cfg[c.key] = c.type ? input.value : Number( input.value );
            show();
            if ( c.restart )
                restart();

            // The hold phase only redraws on a new boil frame, so force one now.
            boilIndex = -1;
        } );

        if ( c.type )
            row.append( input );
        else
            row.append( value, input );
        box.append( row );
    }
    buildViewChoices( box );
}

// One checkbox per view. At least one stays ticked, and ticking a view shows it next.
function buildViewChoices(box)
{
    const row = document.createElement( 'div' );
    row.className = 'views';
    for ( const name of Object.keys( VIEWS ) )
    {
        const label = document.createElement( 'label' );
        const input = document.createElement( 'input' );
        input.type = 'checkbox';
        input.checked = cfg.views.includes( name );
        syncs.push( () => input.checked = cfg.views.includes( name ) );
        input.addEventListener( 'change', () =>
        {
            const chosen = [ ...row.querySelectorAll( 'input' ) ]
                .filter( i => i.checked )
                .map( i => i.parentElement.textContent );
            if ( chosen.length === 0 )
            {
                input.checked = true;
                return;
            }
            cfg.views = chosen;
            if ( input.checked )
                restart( name );
            else if ( !chosen.includes( drawing.view ) )
                restart();
        } );
        label.append( input, name );
        row.append( label );
    }
    box.append( row );
}

function configText()
{
    const v = key => typeof cfg[key] === 'string' ? JSON.stringify( cfg[key] ) : cfg[key];
    return `// Doodle Deck options. Steam has no options screen for custom screensavers, so edit this
// file and pick the screensaver again, or restart Steam.

const DOODLE_CONFIG = {
    // Any CSS colour.
    lineColor: ${v( 'lineColor' )},
    background: ${v( 'background' )},

    // How far the lines wobble, from 0 (still) to 3. 1 looks like pencil on paper.
    wobble: ${v( 'wobble' )},

    // How many times a second the drawing is redrawn with new wobble, from 4 to 24.
    boilRate: ${v( 'boilRate' )},

    // Seconds to draw a Deck, to hold it, and to wipe it before the next one.
    drawSeconds: ${v( 'drawSeconds' )},
    holdSeconds: ${v( 'holdSeconds' )},
    wipeSeconds: ${v( 'wipeSeconds' )},

    // Line width in pixels on a 800-pixel-tall screen. It scales with the screen height.
    lineWidth: ${v( 'lineWidth' )},

    // Which views of the Deck to draw: "front", "back" and "top". They come in a random
    // order, never the same one twice in a row.
    views: [${cfg.views.map( name => JSON.stringify( name ) ).join( ', ' )}],
};
`;
}

// The clipboard API needs a secure context, which a file:// page may not be. When it fails,
// the text is shown in the panel so it can be copied by hand.
async function copyConfig()
{
    const text = configText();
    const button = document.getElementById( 'copy' );
    try
    {
        await navigator.clipboard.writeText( text );
        output.style.display = 'none';
        button.textContent = 'Copied';
    }
    catch
    {
        output.value = text;
        output.style.display = 'block';
        output.select();
        button.textContent = 'Select and copy';
    }
    setTimeout( () => button.textContent = 'Copy config.js', 1800 );
}

function resetSettings()
{
    Object.assign( cfg, JSON.parse( JSON.stringify( START ) ) );
    syncs.forEach( sync => sync() );
    output.style.display = 'none';
    restart();
}

function togglePanel()
{
    const hide = !panel.classList.contains( 'hidden' );
    panel.classList.toggle( 'hidden', hide );
    showButton.style.display = hide ? 'block' : 'none';
}

buildControls();
document.getElementById( 'redraw' ).addEventListener( 'click', () => restart() );
document.getElementById( 'copy' ).addEventListener( 'click', copyConfig );
document.getElementById( 'reset' ).addEventListener( 'click', resetSettings );

// In an iframe the settings sit below the Deck, so they stay shown, and the iframe grows to
// fit them. Full screen, they float over the Deck and H hides them.
if ( window.frameElement )
    new ResizeObserver( () => window.frameElement.style.height = document.documentElement.scrollHeight + 'px' )
        .observe( document.body );
if ( window.self === window.top )
{
    showButton.addEventListener( 'click', togglePanel );
    document.addEventListener( 'keydown', e =>
    {
        if ( ( e.key === 'h' || e.key === 'H' ) && e.target.tagName !== 'TEXTAREA' )
            togglePanel();
    } );
}
