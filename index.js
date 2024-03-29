/* ////////////////////////// */
/* ИМПОРТЫ И ИХ ИНИЦИАЛИЗАЦИЯ */
/* ////////////////////////// */

const fs = require('fs'),
    express = require('express'),
    app = express(),
    mongoose = require("mongoose"),
    execSync = require("child_process").execSync,
    path = require('path'),
    passport = require("passport"),
    users = require("./models/users"),
    items = require("./models/items"),
    bodyParser = require("body-parser"),
    bcrypt = require("bcrypt"),
    initializePassport = require("./passport-config.js"),
    session = require('express-session'),
    mongoStore = require('connect-mongo'),
    methodOverride = require('method-override'),
    frontendIP = process.env.FRONTEND_IP || 'localhost';
    MongoServerIP = process.env.MONGO_SERVER_IP || '127.0.0.1',
    MongoURL = `mongodb://${MongoServerIP}:27017/serega-univermag`;


app.use(express.json({ limit: 16000000 * 1.1 }));
app.use(bodyParser.urlencoded({ extended: true, limit: '500mb' }));

app.use(express.static(path.join(__dirname, 'public')));

app.set('trust proxy', true);

app.use(session({
    store: mongoStore.create({
        mongoUrl: MongoURL,
        ttl: 60 * 60 * 24 * 1
    }),
    secret: process.env.SECRET_WORD || 'SECRET_WORD',
    resave: false,
    saveUninitialized: false,
    httpOnly: true,
    secure: true
    // cookie: {maxAge: 1000 * 60 * 60 * 24 * 1}
}));

app.use(passport.initialize());
app.use(passport.session());
initializePassport(
    passport,
    email => users.findOne({email: email}),
    id => users.findOne({_id: id}),
);

app.use(methodOverride('_method'));


/* ////////////////////////// */
/* НАСТРОЙКА И ЗАПУСК СЕРВЕРА */

/* ////////////////////////// */

async function start() {
    try {
        console.log('CONNECTING TO DATABASE...');

        const OS = process.platform;

        switch (OS) {
            case 'win32':
                try {
                    execSync('net start mongodb', {stdio: 'pipe'});
                } catch {
                }
                break;

            // case "linux":
            //     try {
            //         execSync('systemctl restart mongod', { stdio : 'pipe' });
            //     } catch {}
            //     break;
        }

        mongoose.set('strictQuery', false);
        await mongoose.connect(MongoURL, {
            autoIndex: false,
            useNewUrlParser: true,
            useUnifiedTopology: true
        }).then(() => {
            console.log('SUCCESSFUL CONNECTION TO DB!');
            app.listen(3012);
        });

    } catch (e) {
        console.log(e);
    }
}

start()
    .then(() => {
        console.log('SERVER STARTED.');
    })
    .catch((e) => {
        throw new Error(e);
    });


/* /////// */
/* ЗАПРОСЫ */
/* /////// */

app.get('/', (req, res) => {
    res.json({good: true});
});


app.post('/login', checkNotAuthenticated,
    passport.authenticate("local", {
        successRedirect: '/api/is_authenticated',
        failureRedirect: '/api/is_authenticated',
    }));

app.post('/registration', checkNotAuthenticated, async (req, res) => {
    await RequestTryCatch(req, res, async () => {
        const body = await req.body;
        if (await users.findOne({email: body.email})) {
            return res.json({
                exist: true,
                result: false
            });
        } else {
            let hashedPassword = await bcrypt.hashSync(body.password, 12);

            const user = await new users({
                firstname: body.firstname,
                lastname: body.lastname,
                email: body.email,
                password: hashedPassword,
                accountType: 0,
                created: Date.now()
            });

            user.save()
                .then(() => {
                    return res.json({
                        exist: false,
                        result: true
                    });
                })
                .catch((e) => {
                    console.error(e);
                    return res.json({
                        exist: false,
                        result: false
                    });
                });
        }
    });
});

app.delete('/logout', checkAuthenticated, async (req, res) => {
    await RequestTryCatch(req, res, async () => {
        await req.logOut(() => {});
        res.json({result: true});
    })
});

app.get('/is_authenticated', (req, res) => {
    res.json({result: req.isAuthenticated()});
});

app.get('/get_account_info', checkAuthenticated, async (req, res) => {
    await RequestTryCatch(req, res, async () => {
        return res.json(await getUser(req, res));
    });
});

app.get('/get-item/:id', async (req, res) => {
    const id = req.params.id;
    await res.json(await items.findOne({ _id: id }, { __v: 0 }));
});

app.get('/get-items', async (req, res) => {
   await res.json(await items.find({}, { __v: 0 }));
});

app.post('/create-item', checkAdmin, async (req, res) => {
    const body = req.body;

    const item = new items({
        name: body.name,
        description: body.description,
        category: body.category,
        price: body.price,
        weight: body.weight,
        image: body.image
    });

    item.save()
        .then(() => {
            return res.json({
                result: true,
                error: false
            });
        })
        .catch(() => {
            return res.json({
                result: false,
                error: 'Произошла неизвестная ошибка, попробуйте еще раз!'
            });
        })
});

app.get('/remove-item/:id', checkAdmin, async (req, res) => {
    const id = req.params.id;
    items.deleteOne({ _id: id })
        .then(() => {
            return res.json({
                result: true,
                error: null
            });
        })
        .catch(() => {
            return res.json({
                result: false,
                error: 'Произошла неизвестная ошибка!'
            });
        });
});

/* /////// */
/* ФУНКЦИИ */
/* /////// */

async function RequestTryCatch(req, res, cb = async () => {
}) {
    try {
        await cb();
    } catch (e) {
        console.error(e);
        return res.json({error: 'Произошла ошибка при выполнении запроса.'});
    }
}

async function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return res.json({
            error: 'Пользователь уже авторизован.'
        });
    }

    next();
}

async function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }

    res.json({
        error: 'Пользователь не авторизован.'
    });
}


async function getUser(req, res) {
    const user = {
        logged: req.isAuthenticated(),
        firstname: null,
        lastname: null,
        email: null,
        phone: null,
        accountType: null,
        created: null,
    };
    try {
        if (user.logged) {
            await req.user.clone()
                .then((data) => {
                    user.firstname = data.firstname;
                    user.lastname = data.lastname;
                    user.email = data.email;
                    user.phone = data.phone || null;
                    user.accountType = data.accountType;
                    user.created = data.created;
                });
        }
    } catch (e) {
        console.error(e);
    }

    return user;
}

async function checkAdmin(req, res, next) {
    await RequestTryCatch(req, res, async () => {
        const session = await req.user.clone();
        if (req.isAuthenticated() && session.accountType >= 1) {
            return next();
        } else {
            return res.json({
                error: 'Недостаточно прав доступа.'
            });
        }
    });
}

async function validAndEditImageToDB(reqFile) {
    if (reqFile) {
        console.log(reqFile)
        try {
            const acceptedMimetypes = ['image/png', 'image/jpg', 'image/jpeg', 'image/bmp', 'image/gif']
            if (reqFile.size > 16000000 /* 16МБ */ || !acceptedMimetypes.includes(reqFile.mimetype)) {
                return null;
            }

            return {
                mimetype: reqFile.mimetype,
                buffer: fs.readFileSync(reqFile.tempFilePath)
            };
        } catch (e) {
            console.error(e)
        }
    }
}