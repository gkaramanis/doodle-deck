// Hand-drawn Steam Deck outlines for Steam. The shapes are in millimetres, centred on the
// Deck with y pointing down. Each boil frame redraws every stroke with new low-frequency
// wobble, which gives the line-boil look of hand-drawn animation.

const FPS = 30;
const STEP = 1;
const DECK_SIZE = { w: 298, h: 125 };   // the front view, which sets the scale for every view

const DEFAULTS = {
    lineColor: '#f2efe6',
    background: '#000000',
    wobble: 1,
    boilRate: 10,
    drawSeconds: 6,
    holdSeconds: 10,
    wipeSeconds: 1.5,
    lineWidth: 2.5,
    views: [ 'front', 'back', 'top' ],
};

const clamp = ( v, lo, hi ) => Math.min( hi, Math.max( lo, v ) );
const rand = ( lo, hi ) => lo + Math.random() * ( hi - lo );

// Query parameters override config.js, so index.html?wobble=2&views=front,top previews a
// change.
function readConfig()
{
    const cfg = Object.assign( {}, DEFAULTS, typeof DOODLE_CONFIG === 'object' ? DOODLE_CONFIG : {} );
    for ( const [ key, value ] of new URLSearchParams( location.search ) )
    {
        if ( !( key in DEFAULTS ) )
            continue;
        cfg[key] = typeof DEFAULTS[key] === 'number' ? Number( value )
            : Array.isArray( DEFAULTS[key] ) ? value.split( ',' ) : value;
    }
    cfg.views = ( Array.isArray( cfg.views ) ? cfg.views : DEFAULTS.views ).map( v => String( v ).trim().toLowerCase() );
    cfg.wobble = clamp( Number( cfg.wobble ) || 0, 0, 3 );
    cfg.boilRate = clamp( Number( cfg.boilRate ) || DEFAULTS.boilRate, 4, 24 );
    cfg.drawSeconds = Math.max( 0.5, Number( cfg.drawSeconds ) || DEFAULTS.drawSeconds );
    cfg.holdSeconds = Math.max( 0, Number( cfg.holdSeconds ) || 0 );
    cfg.wipeSeconds = Math.max( 0.2, Number( cfg.wipeSeconds ) || DEFAULTS.wipeSeconds );
    cfg.lineWidth = clamp( Number( cfg.lineWidth ) || DEFAULTS.lineWidth, 0.5, 12 );
    return cfg;
}

// Geometry

// Respaces a polyline so its points sit STEP millimetres apart.
function resample(points, closed)
{
    const src = closed ? points.concat( [ points[0] ] ) : points;
    const out = [ src[0] ];
    let carry = 0;
    for ( let i = 1; i < src.length; i++ )
    {
        const [ ax, ay ] = src[i - 1];
        const [ bx, by ] = src[i];
        const len = Math.hypot( bx - ax, by - ay );
        let d = STEP - carry;
        while ( d <= len )
        {
            out.push( [ ax + ( bx - ax ) * d / len, ay + ( by - ay ) * d / len ] );
            d += STEP;
        }
        carry = len - ( d - STEP );
    }
    if ( closed )
        out.pop();
    return out;
}

function circle(cx, cy, r)
{
    const n = Math.max( 12, Math.ceil( 2 * Math.PI * r / STEP ) );
    return Array.from( { length: n }, ( _, i ) =>
    {
        const a = -Math.PI / 2 + i / n * 2 * Math.PI;
        return [ cx + r * Math.cos( a ), cy + r * Math.sin( a ) ];
    } );
}

function roundedRect(cx, cy, w, h, r)
{
    const x0 = cx - w / 2 + r, x1 = cx + w / 2 - r;
    const y0 = cy - h / 2 + r, y1 = cy + h / 2 - r;
    const corners = [ [ x1, y0, -90 ], [ x1, y1, 0 ], [ x0, y1, 90 ], [ x0, y0, 180 ] ];
    const pts = [];
    for ( const [ ox, oy, start ] of corners )
    {
        for ( let k = 0; k <= 8; k++ )
        {
            const a = ( start + k * 90 / 8 ) * Math.PI / 180;
            pts.push( [ ox + r * Math.cos( a ), oy + r * Math.sin( a ) ] );
        }
    }
    return resample( pts, true );
}

// Catmull-Rom curves through control points, closed or open.
function catmullRom(ctrl, closed)
{
    const pts = [];
    const n = ctrl.length;
    const at = i => closed ? ctrl[( i + n ) % n] : ctrl[clamp( i, 0, n - 1 )];
    for ( let i = 0; i < ( closed ? n : n - 1 ); i++ )
    {
        const p0 = at( i - 1 ), p1 = at( i ), p2 = at( i + 1 ), p3 = at( i + 2 );
        for ( let k = 0; k < 10; k++ )
        {
            const t = k / 10, t2 = t * t, t3 = t2 * t;
            pts.push( [ 0, 1 ].map( c => 0.5 * ( 2 * p1[c] + ( p2[c] - p0[c] ) * t
                + ( 2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c] ) * t2
                + ( 3 * p1[c] - p0[c] - 3 * p2[c] + p3[c] ) * t3 ) ) );
        }
    }
    if ( !closed )
        pts.push( ctrl[n - 1] );
    return resample( pts, closed );
}

const smoothLoop = ctrl => catmullRom( ctrl, true );

// An open stroke, which the hand-drawn views mark so it isn't closed into a loop.
const smoothLine = ctrl => ( { pts: catmullRom( ctrl, false ), closed: false } );
const straightLine = corners => ( { pts: resample( corners, false ).concat( [ corners[corners.length - 1] ] ), closed: false } );

const mirror = pts => pts.map( ( [ x, y ] ) => [ -x, y ] );

function dpad(cx, cy, arm, half)
{
    const a = arm / 2;
    const corners = [
        [ -a, -half ], [ a, -half ], [ a, -a ], [ half, -a ], [ half, a ], [ a, a ],
        [ a, half ], [ -a, half ], [ -a, a ], [ -half, a ], [ -half, -a ], [ -a, -a ],
    ];
    return resample( corners.map( ( [ x, y ] ) => [ cx + x, cy + y ] ), true );
}

// The outline seen from the front or the back, measured from Valve's drawing: tight top
// corners, wide bottom ones and a flat bottom. The Deck is symmetric, so both views share it.
function bodyOutline()
{
    const right = [
        [ 60, -57.9 ], [ 125, -57.9 ], [ 132.5, -57.1 ], [ 137.5, -55.6 ], [ 142.5, -53.4 ],
        [ 145.5, -50 ], [ 147.8, -46 ], [ 149, -40 ], [ 149.1, -20 ], [ 149, 0 ], [ 148.6, 17 ],
        [ 147.7, 29.5 ], [ 146.5, 37 ], [ 144.5, 43.5 ], [ 141.4, 49.5 ], [ 137, 53.5 ], [ 132, 55.5 ],
        [ 126, 57.2 ], [ 118, 58.4 ], [ 108, 58.9 ], [ 100, 59 ], [ 50, 59 ],
    ];
    return smoothLoop( [ [ 0, -57.9 ], ...right, [ 0, 59 ], ...mirror( right ).reverse() ] );
}

// The front, with positions and sizes from Valve's drawing. Each speaker grille is drawn as
// its three rows of slots.
function frontView()
{
    const shapes = [
        bodyOutline(),
        roundedRect( 0, 0.2, 174, 107.8, 3 ),
        roundedRect( 0, 0.2, 151.7, 95.2, 0.8 ),
        roundedRect( 0, 57.2, 170, 2, 1 ),
        straightLine( [ [ -125.4, -57.8 ], [ -125.4, -54.4 ], [ 125.5, -54.4 ], [ 125.5, -57.8 ] ] ),
    ];
    for ( const x of [ -82.3, -71.3 ] )
        shapes.push( smoothLine( [ [ x - 3.2, -57.8 ], [ x - 2.6, -59 ], [ x + 2.6, -59 ], [ x + 3.2, -57.8 ] ] ) );

    for ( const side of [ -1, 1 ] )
    {
        const seam = [ [ 115.6, 34.1 ], [ 109.8, 43.5 ], [ 105, 49.3 ], [ 97.6, 54.1 ], [ 89.5, 55.4 ] ];
        shapes.push( smoothLine( side < 0 ? mirror( seam ) : seam ) );
        shapes.push( circle( 102.8 * side, -33.9, 9.1 ), circle( 102.8 * side, -33.9, 6.2 ) );
        shapes.push( roundedRect( 105.7 * side, -0.8, 33.1, 33.1, 4.5 ) );
        shapes.push( roundedRect( 97.6 * side, 24.6, 16.9, 7.1, 3.5 ) );
        shapes.push( roundedRect( 115.1 * side, -51.3, 9.5, 4.2, 2.1 ) );
        for ( const [ inner, outer, y ] of [ [ 90.1, 106.4, 34.6 ], [ 90.1, 104.2, 37.8 ], [ 90.1, 101.9, 41 ] ] )
            shapes.push( roundedRect( ( inner + outer ) / 2 * side, y, outer - inner, 1.3, 0.65 ) );
    }
    shapes.push( dpad( -131.6, -39, 7.6, 11 ) );
    for ( const [ dx, dy ] of [ [ 0, -8.7 ], [ 8.7, 0 ], [ 0, 8.7 ], [ -8.7, 0 ] ] )
        shapes.push( circle( 131.7 + dx, -39 + dy, 4.65 ) );
    return shapes;
}

// The back, with positions and sizes from Valve's drawing. The left of this view is the
// right of the front. Each trigger corner is three lines: the trigger's lower edge, the
// line between the trigger and the bumper, and the bumper's top edge.
function backView()
{
    const corner = [
        [
            [ -148.7, -42.3 ], [ -147.6, -37.9 ], [ -144.9, -35.9 ], [ -138.2, -34.4 ], [ -130.3, -34 ],
            [ -126.1, -34.4 ], [ -122.3, -36.4 ], [ -119, -40.1 ], [ -116.8, -44.4 ], [ -114.5, -48.5 ],
            [ -112.8, -52 ], [ -111, -54.5 ], [ -108, -55.8 ], [ -104.5, -56.6 ], [ -102.5, -58.1 ],
        ],
        [
            [ -146.2, -43.1 ], [ -139.6, -44.7 ], [ -131.6, -46.6 ], [ -125.8, -45.9 ], [ -121.4, -46.9 ],
            [ -119.2, -49 ], [ -117.6, -51.7 ],
        ],
        [
            [ -145, -45.3 ], [ -135.5, -49.1 ], [ -125.6, -51.7 ], [ -118.7, -55.4 ], [ -117.7, -57 ],
            [ -116.5, -58.1 ], [ -113.4, -58.5 ],
        ],
    ];
    const shapes = [ bodyOutline() ];
    for ( const side of [ -1, 1 ] )
    {
        for ( const line of corner )
            shapes.push( smoothLine( side < 0 ? line : mirror( line ) ) );
        shapes.push( straightLine( [ [ 88 * side, 49 ], [ 88 * side, -54.8 ], [ 103 * side, -55.2 ] ] ) );
        shapes.push( roundedRect( 109.7 * side, 0.6, 22, 21.7, 4 ), roundedRect( 109.7 * side, 23.3, 22, 21.7, 4 ) );
        for ( const [ x, y ] of [ [ 97, -51.8 ], [ 108, 48.7 ], [ 28.3, 52.2 ], [ 27, -39.8 ] ] )
            shapes.push( circle( x * side, y, 1.85 ) );
    }
    for ( let k = 0; k < 6; k++ )
        shapes.push( roundedRect( -81.7 + 9.5 * k, 25.15, 7, 23.9, 3.5 ) );
    shapes.push( straightLine( [ [ -80.7, 57.7 ], [ -66.7, 57.7 ] ] ) );
    for ( const x of [ 82.3, 71.3 ] )
        shapes.push( smoothLine( [ [ x - 3.2, -58.3 ], [ x - 2.6, -59.5 ], [ x + 2.6, -59.5 ], [ x + 3.2, -58.3 ] ] ) );
    return shapes;
}

// The top edge seen from above with the front face down, measured from Valve's drawing.
// The trigger humps sit at the ends; the sticks, d-pad and ABXY show below the front edge.
function topView()
{
    const right = [
        [ 88, -5.8 ], [ 98, -6.9 ], [ 104, -7.3 ], [ 108, -8.6 ], [ 113, -13.2 ], [ 116, -18.3 ],
        [ 119, -21.9 ], [ 122, -24 ], [ 128, -24.9 ], [ 134, -24.6 ], [ 140, -23.4 ], [ 143, -21.6 ],
        [ 146, -18.7 ], [ 148.3, -12 ], [ 149, -5 ], [ 149.1, 0 ], [ 148.3, 5 ], [ 146.5, 8.5 ],
        [ 143, 11.2 ], [ 138, 12.5 ], [ 130, 12.7 ], [ 88, 12.7 ],
    ];
    const shapes = [
        smoothLoop( [ [ 0, -5.8 ], ...right, [ 0, 12.7 ], ...mirror( right ).reverse() ] ),
        straightLine( [ [ -104, -0.3 ], [ 104, -0.3 ] ] ),
    ];

    // The left end; the right end mirrors it.
    const trigger = [
        [ -145.9, -3.8 ], [ -145.1, -10.9 ], [ -142.6, -17 ], [ -138, -21.1 ], [ -129.8, -23 ],
        [ -125.2, -22.1 ], [ -121.6, -18.1 ], [ -117.6, -9.9 ], [ -117.8, -8.1 ], [ -131.5, -5.5 ],
    ];
    const bumper = [
        [ -146.6, -0.7 ], [ -144.6, -2.2 ], [ -117.6, -7.3 ], [ -116.5, -7.3 ], [ -113.5, -3.8 ],
        [ -107.3, -2.6 ], [ -103.8, -1.5 ], [ -102.8, 0.3 ], [ -102.8, 3.4 ], [ -104.3, 5.4 ],
        [ -107.3, 6.4 ], [ -142, 5.9 ], [ -146.1, 3.4 ],
    ];
    const neck = [
        [ -114.6, 12.7 ], [ -113, 16 ], [ -111.5, 18.2 ], [ -94, 18.2 ], [ -92.2, 16.5 ], [ -90, 13.5 ],
        [ -88.5, 12.7 ],
    ];
    for ( const side of [ -1, 1 ] )
    {
        const flip = pts => side < 0 ? pts : mirror( pts );
        shapes.push( smoothLoop( flip( trigger ) ), smoothLoop( flip( bumper ) ) );
        shapes.push( smoothLine( flip( neck ) ), roundedRect( 102.8 * side, 23.9, 16, 4.2, 1.5 ) );
        shapes.push( roundedRect( 131.7 * side, 14.6, 22, 4, 1.5 ) );
    }

    // Ports and buttons, left to right: volume down, volume up, headphone jack, the vent,
    // USB-C, the LED and the power button.
    for ( const x of [ -82.3, -71.3 ] )
        shapes.push( circle( x, 4.2, 3.6 ), circle( x, 4.2, x < -80 ? 2.25 : 1.4 ) );
    shapes.push( circle( -51.1, 4.2, 3.5 ), circle( -51.1, 4.2, 2.4 ) );
    for ( let x = -25; x <= 25; x += 5 )
        shapes.push( roundedRect( x, 3.3, 3.5, 6.2, 1.75 ) );
    shapes.push( roundedRect( 51.1, 4.2, 9.9, 4.1, 2.05 ), circle( 64.6, 4.2, 1 ) );
    shapes.push( circle( 76.8, 4.2, 3.95 ), circle( 76.8, 4.2, 2.75 ) );
    return shapes;
}

// Centres a view's shapes on their bounding box and records its size. Each shape is
// { pts, closed }.
function centred(shapes)
{
    const pts = shapes.flatMap( s => s.pts );
    const xs = pts.map( p => p[0] ), ys = pts.map( p => p[1] );
    const x0 = Math.min( ...xs ), x1 = Math.max( ...xs ), y0 = Math.min( ...ys ), y1 = Math.max( ...ys );
    const cx = ( x0 + x1 ) / 2, cy = ( y0 + y1 ) / 2;
    return {
        size: { w: x1 - x0, h: y1 - y0 },
        shapes: shapes.map( s => ( { closed: s.closed, pts: s.pts.map( ( [ x, y ] ) => [ x - cx, y - cy ] ) } ) ),
    };
}

// Plain point lists are closed loops; open strokes come from smoothLine.
const loops = shapes => shapes.map( s => Array.isArray( s ) ? { pts: s, closed: true } : s );

// Each view's shapes. They are drawn in a new random order for every Deck.
const VIEWS = {
    front: centred( loops( frontView() ) ),
    back: centred( loops( backView() ) ),
    top: centred( loops( topView() ) ),
};

// Drawings

// Picks the next view from the configured ones, never the same twice in a row.
function nextView(previous)
{
    const names = cfg.views.filter( v => v in VIEWS );
    const pool = names.length > 1 ? names.filter( v => v !== previous ) : names;
    return pool.length ? pool[Math.floor( Math.random() * pool.length )] : 'front';
}

// Each loop starts at a random point and runs a little past its start, the way a hand
// closes a shape.
const loopStyle = () => ( { start: Math.random(), over: rand( 0.03, 0.12 ) } );

function closedStroke(shape, style)
{
    const loop0 = resample( shape, true );
    const start = Math.floor( style.start * loop0.length );
    const loop = loop0.slice( start ).concat( loop0.slice( 0, start ) );
    const pts = loop.concat( loop.slice( 0, Math.ceil( loop.length * style.over ) + 1 ) );
    return { pts, length: pts.length * STEP };
}

// Fisher-Yates shuffle of a copy.
function shuffled(items)
{
    const out = items.slice();
    for ( let i = out.length - 1; i > 0; i-- )
    {
        const j = Math.floor( Math.random() * ( i + 1 ) );
        [ out[i], out[j] ] = [ out[j], out[i] ];
    }
    return out;
}

function openStroke(line)
{
    const pts = resample( line, false );
    const last = line[line.length - 1];
    if ( Math.hypot( last[0] - pts[pts.length - 1][0], last[1] - pts[pts.length - 1][1] ) > STEP / 4 )
        pts.push( last );
    return { pts, length: pts.length * STEP };
}

// One Deck on screen. The scale comes from the whole Deck, so every view is drawn at the
// same size.
function newDrawing(width, height, viewName)
{
    const view = VIEWS[viewName];
    const { w, h } = view.size;
    const fit = Math.min( width * rand( 0.45, 0.68 ) / DECK_SIZE.w, height * 0.72 / DECK_SIZE.h,
        width * 0.9 / w, height * 0.9 / h );
    const angle = rand( -7, 7 ) * Math.PI / 180;
    const halfW = ( w * Math.abs( Math.cos( angle ) ) + h * Math.abs( Math.sin( angle ) ) ) * fit / 2;
    const halfH = ( w * Math.abs( Math.sin( angle ) ) + h * Math.abs( Math.cos( angle ) ) ) * fit / 2;

    const strokes = shuffled( view.shapes ).map( s => s.closed ? closedStroke( s.pts, loopStyle() ) : openStroke( s.pts ) );

    return {
        view: viewName,
        strokes,
        scale: fit,
        angle,
        x: rand( halfW * 1.05, Math.max( halfW * 1.05, width - halfW * 1.05 ) ),
        y: rand( halfH * 1.05, Math.max( halfH * 1.05, height - halfH * 1.05 ) ),
        total: strokes.reduce( ( sum, s ) => sum + s.length + 12, 0 ),
    };
}

// Wobble for one boil frame: two sine waves per axis along each stroke, a small shift of
// the whole stroke, and a slight change in line width.
function boilFrame(drawing, wobble)
{
    return drawing.strokes.map( stroke =>
    {
        const size = 0.4 + 0.6 * clamp( stroke.length / 80, 0, 1 );
        const amp = wobble * size;
        const wave = big => ( {
            freq: Math.max( 0.5, stroke.length / rand( 40, 90 ) ) * ( big ? 1 : 2.3 ),
            phase: rand( 0, 2 * Math.PI ),
            amp: amp * ( big ? 0.7 : 0.3 ) * rand( 0.6, 1 ),
        } );
        return {
            x: [ wave( true ), wave( false ) ],
            y: [ wave( true ), wave( false ) ],
            shift: [ rand( -0.35, 0.35 ) * amp, rand( -0.35, 0.35 ) * amp ],
            jitter: 0.12 * amp,
            seed: rand( 0, 1000 ),
            width: rand( 0.85, 1.15 ),
        };
    } );
}

function offset(waves, u)
{
    return waves.reduce( ( sum, w ) => sum + w.amp * Math.sin( 2 * Math.PI * w.freq * u + w.phase ), 0 );
}

// A fixed value in [-1, 1] for each point and seed, so jitter only changes with the boil.
function hash(k, seed)
{
    const s = Math.sin( k * 12.9898 + seed * 78.233 ) * 43758.5453;
    return 2 * ( s - Math.floor( s ) ) - 1;
}

// Rendering

const canvas = document.getElementById( 'doodle' );
const ctx = canvas.getContext( '2d' );
const cfg = readConfig();

let drawing = null;
let boil = null;
let boilIndex = -1;
let phaseStart = 0;
let lastFrame = 0;

// Starts a new Deck from the beginning of the cycle, in the given view or the next one.
function restart(viewName)
{
    viewName = viewName in VIEWS ? viewName : nextView( drawing && drawing.view );
    drawing = newDrawing( canvas.width, canvas.height, viewName );
    boilIndex = -1;
    phaseStart = performance.now();
}

function resize()
{
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round( canvas.clientWidth * dpr );
    canvas.height = Math.round( canvas.clientHeight * dpr );
    restart();
}

// Draws the strokes up to `reach` millimetres of pen travel, at the given opacity.
function render(reach, alpha)
{
    ctx.fillStyle = cfg.background;
    ctx.fillRect( 0, 0, canvas.width, canvas.height );
    if ( alpha <= 0 )
        return;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = cfg.lineColor;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.translate( drawing.x, drawing.y );
    ctx.rotate( drawing.angle );
    ctx.scale( drawing.scale, drawing.scale );
    const baseWidth = cfg.lineWidth * canvas.height / 800 / drawing.scale;

    let travelled = 0;
    drawing.strokes.forEach( ( stroke, i ) =>
    {
        const shown = Math.floor( clamp( ( reach - travelled ) / STEP, 0, stroke.pts.length ) );
        travelled += stroke.length + 12;
        if ( shown < 2 )
            return;

        const w = boil[i];
        ctx.lineWidth = baseWidth * w.width;
        ctx.beginPath();
        for ( let k = 0; k < shown; k++ )
        {
            const [ px, py ] = stroke.pts[k];
            const u = k / stroke.pts.length;
            const x = px + w.shift[0] + offset( w.x, u ) + w.jitter * hash( k, w.seed );
            const y = py + w.shift[1] + offset( w.y, u ) + w.jitter * hash( k, w.seed + 1 );
            k === 0 ? ctx.moveTo( x, y ) : ctx.lineTo( x, y );
        }
        ctx.stroke();
    } );
    ctx.restore();
}

function tick(now)
{
    requestAnimationFrame( tick );

    const t = ( now - phaseStart ) / 1000;
    const cycle = cfg.drawSeconds + cfg.holdSeconds + cfg.wipeSeconds;
    if ( t >= cycle )
    {
        restart();
        return;
    }

    const index = Math.floor( now * cfg.boilRate / 1000 );
    const moving = t < cfg.drawSeconds || t > cfg.drawSeconds + cfg.holdSeconds;
    if ( index === boilIndex && !( moving && now - lastFrame >= 1000 / FPS ) )
        return;
    if ( index !== boilIndex )
    {
        boil = boilFrame( drawing, cfg.wobble );
        boilIndex = index;
    }
    lastFrame = now;

    const reach = drawing.total * clamp( t / cfg.drawSeconds, 0, 1 );
    const alpha = 1 - clamp( ( t - cfg.drawSeconds - cfg.holdSeconds ) / cfg.wipeSeconds, 0, 1 );
    render( reach, alpha );
}

window.addEventListener( 'resize', resize );
resize();
requestAnimationFrame( tick );
