import express from 'express';
import db from './database/config.js';

const app = express();
const log = console.log;

app.get('/', (req, res) => {
    res.send('Ruta principal')
});

app.listen(3000, () => {
    log('Servidor escuchando en http://localhost:3000')
});

//ENDPOINT
app.get('/api/v1/productos', async (req, res) => {
    try {
        let { nombre, precio_min, precio_max } = req.query;

        let consulta = 'SELECT id, nombre, descripcion, precio, stock, id_categoria, id_marca FROM productos'
        let values = [];
        //Filtros: por nombre/precio_min y precio_max: /productos?nombre=e&precio_min=700&precio_max=1200
        if (nombre && precio_min && precio_max) {
            consulta = "SELECT id, nombre, descripcion, precio, stock, id_categoria, id_marca FROM productos WHERE (nombre ilike $1 OR descripcion ilike $1) AND precio BETWEEN  $2 AND $3 ORDER BY precio";
            values = [`%${nombre}%`, precio_min, precio_max]
        } else if (nombre && precio_min) {
            consulta = "SELECT id, nombre, descripcion, precio, stock, id_categoria, id_marca FROM productos WHERE (nombre ilike $1 OR descripcion ilike $1) AND precio >=  $2 ORDER BY precio";
            values = [`%${nombre}%`, precio_max]
        } else if (nombre && precio_min) {
            consulta = "SELECT id, nombre, descripcion, precio, stock, id_categoria, id_marca FROM productos WHERE (nombre ilike $1 OR descripcion ilike $1) AND precio <=  $2 ORDER BY precio";
            values = [`%${nombre}%`, precio_max]
            // Filtro rango precios: /productos?precio_min=800&precio_max=2000
        } else if (precio_min && precio_max) {
            consulta = "SELECT id, nombre, descripcion, precio, stock, id_categoria, id_marca FROM productos WHERE precio BETWEEN  $1 AND $2 ORDER BY precio";
            values = [precio_min, precio_max]
            // Filtro precio minimo: /productos?precio_min=3000
        } else if (precio_min) {
            consulta = "SELECT id, nombre, descripcion, precio, stock, id_categoria, id_marca FROM productos WHERE precio >= $1 ORDER BY precio";
            values = [precio_min]
            // Filtro precio maximo: /productos?precio_max=3000
        } else if (precio_max) {
            consulta = "SELECT id, nombre, descripcion, precio, stock, id_categoria, id_marca FROM productos WHERE precio <= $1 ORDER BY precio";
            values = [precio_max]
            //Filtros: por nombre/descripcion: /productos?nombre=leche
        } else if (nombre) {
            consulta = "SELECT id, nombre, descripcion, precio, stock, id_categoria, id_marca FROM productos WHERE nombre ilike $1 OR descripcion ilike $1 ";
            values = [`%${nombre}%`]
        }
        let results = await db.query(consulta, values)
        let productos = results.rows;
        res.json({ productos })
    } catch (error) {
        log(error)
        res.status(500).json({ message: 'Error al obtener productos.' })
    }
});

//endpoints marcas, categorias podria ser dinamico
app.get('/api/v1/productos/filtros/:filtros', async (req, res) => {
    try {
        let { filtros } = req.params;
        if (filtros === 'marcas') {
            let consulta = 'SELECT id, nombre FROM marcas ORDER BY id';
            let { rows } = await db.query(consulta);
            res.json({ marcas: rows })
        } else if (filtros === 'categorias') {
            let consulta = 'SELECT id, nombre FROM categorias ORDER BY id';
            let { rows } = await db.query(consulta);
            res.json({ categorias: rows })
        } else {
            res.status(400).json({ message: "Parámetro inválido. Solo se permite búsquedas por 'marcas' o 'categorias'." })
        }
    } catch (error) {
        log(error.message)
        res.status(500).json({ error: 'Error interno del servidor' })
    }
});

// app.get('/api/v1/categorias', async (req, res) => {
//     try {
//         let consulta = 'SELECT id, nombre FROM categorias ORDER BY id';
//         let { rows } = await db.query(consulta);
//         res.json({categorias: rows})
//     } catch (error) {
//         log(error)
//         res.status(500).json({ message: 'Error al obtener las categorías.' })
//     }
// });

// app.get('/api/v1/marcas', async (req, res) => {
//     try {
//         let consulta = 'SELECT id, nombre FROM marcas ORDER BY id';
//         let { rows } = await db.query(consulta);
//         res.json({marcas: rows})
//     } catch (error) {
//         log(error)
//         res.status(500).json({ message: 'Error al obtener las marcas.' })
//     }
// });

// Filtros usando inner join por marcas
app.get('/api/v1/productos/filter/marca/:marca', async (req, res) => {
    try {
        let { marca } = req.params
        
        let consulta = {
            text: `SELECT p.id, p.nombre, p.descripcion, p.precio, p.stock, m.nombre AS marca 
            FROM productos P 
            INNER JOIN marcas M 
            ON M.id = P.id_marca WHERE m.nombre ilike $1 `,
            values: [`%${marca}%`]
        }
        // let respuesta = await db.query(consulta);
        // res.json(respuesta.rows)
        let { rows } = await db.query(consulta);
        res.json({ Productos: rows})
    } catch (error) {
        res.status(500).json({message: 'Error al intentar filtrar los productos por marca.'})
    }
});

// Filtros usando inner join por categorias
app.get('/api/v1/productos/filter/categoria/:categoria', async (req, res) => {
    try {
        let { categoria } = req.params
        
        let consulta = {
            text: `SELECT p.id, p.nombre, p.descripcion, p.precio, p.stock, c.nombre AS categoria, m.nombre AS marca
            FROM productos p 
            INNER JOIN categorias c ON c.id = p.id_categoria 
            INNER JOIN marcas m ON m.id = p.id_marca
            WHERE c.nombre ilike $1 `,
            values: [`%${categoria}%`]
        }
        let { rows } = await db.query(consulta);
        res.json({ Productos: rows})
    } catch (error) {
        log(error.message)
        res.status(500).json({message: 'Error al intentar filtrar los productos por categoría.'})
    }
});

// Paginacion
app.get('/api/v1/productos/paginacion', async (req, res) => {
    try {
        let { offset, limit } = req.query;
        offset = Number(offset);
        limit = Number(limit);
        let consulta = {
            text: 'SELECT id, nombre, descripcion, precio, stock FROM PRODUCTOS OFFSET $1 LIMIT $2',
            values: [offset, limit]
        }
        let { rows } = await db.query(consulta);
        
        let siguiente;
        if (rows.length > 0 ) {
            siguiente = `http://localhost:3000/api/v1/productos/paginacion?offset=${offset+limit}&limit=${limit}`
        }
        let atras;
        if (offset > 0 ) {
            let contadorAtras = offset-limit;
            if (contadorAtras < 0 ) {
                contadorAtras = 0;
            }
            atras = `http://localhost:3000/api/v1/productos/paginacion?offset=${contadorAtras}&limit=${limit}`
        }
        let respuesta = {
            siguiente,
            atras,
            productos: rows
        }
        res.json({ respuesta})
    } catch (error) {
        log(error.message)
        res.status(500).json({message: 'Error al obtener los productos paginados.'})
    }
});