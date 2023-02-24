<script lang='ts'>
    import {onMount} from 'svelte';
    import {
        username42,
        currentPage,
        level,
        logged,
        losses,
        username,
        wins,
        image_url,
        firstname,
        lastname,
        id,
        intra,
        TWOFA,
        cookie,
        email,
        ownmail
    } from '../stores.js';
    import io, {Manager} from 'socket.io-client';

    export let socket = null;

    interface Auth {
        id: string,
        userName: string,
        userName42: string,
        firstName: string,
        lastName: string,
        wins: number,
        losses: number,
        level: number,
        imageURL: string,
        TWOFA: boolean,
        email: string,
        ownMail: boolean,
    }

    let code: string = '';
    let error: boolean = false;

    import {FRONTEND_URL, BACKEND_URL} from '../domain.js'

    async function sendCode() {
        await fetch(`${BACKEND_URL}/auth/activation/` + code, {
            method: 'GET',
            headers:
                {
                    'Authorization': 'Bearer ' + $cookie,
                    "Content-type": "application/json; charset=UTF-8"
                },
        }).then(response => {
            if (response.status === 200) {
                logged.update(n => 'true');
            } else {
                code = '';
                error = true;
            }
        })
    }

    function updateAll(isAuth: Auth) {
        id.update(n => isAuth.id);
        username.update(n => isAuth.userName);
        username42.update(n => isAuth.userName42)
        firstname.update(n => isAuth.firstName);
        lastname.update(n => isAuth.lastName);
        wins.update(n => isAuth.wins);
        losses.update(n => isAuth.losses);
        level.update(n => isAuth.level);
        image_url.update(n => isAuth.imageURL);
        TWOFA.update(n => isAuth.TWOFA.toString());
        email.update(n => isAuth.email);
        ownmail.update(n => isAuth.ownMail.toString());
    }

    onMount(async () => {
            currentPage.update(n => 'home')
            let cookies = document.cookie?.split(';').find(n => n.startsWith('access_token'));
            if (!cookies) {
                return;
            }
            if ($intra == 'false') {
                cookie.update(n => cookies.split('=')[1]);
                let isAuth: Promise<Auth> = await fetch(`${BACKEND_URL}/auth/currentuser`,
                    {
                        method: 'GET',
                        credentials: 'include',
                        headers:
                            {
                                'Authorization': 'Bearer ' + $cookie,
                                "Content-type": "application/json; charset=UTF-8"
                            },
                    }).then(response => isAuth = response.json());
                updateAll(await isAuth);
                intra.update(n => 'true');
                if ($TWOFA == 'false') {
                    logged.update(n => 'true');
                    socket = io(`${BACKEND_URL}/home`, {
                        auth: {token: $cookie},
                    });
                }
            }
            if ($logged == 'true') {
                socket = io(`${BACKEND_URL}/home`, {
                    auth: {token: $cookie},
                });
            }
        }
    )

</script>
<main>
    <div style="text-align: center;margin: 0 auto;display: block;"></div>
    {#if $logged === 'true'}
        <h1 style="font-weight: 700; margin-top: 50px;">Just a bit of history...</h1>
        <div class="about">
            <p style='text-align:center'>Pong is a table tennis–themed twitch arcade sports video game,
                featuring simple two-dimensional graphics, manufactured by Atari
                and originally released in 1972. It was one of the earliest arcade
                video games; it was created by Allan Alcorn as a training exercise
                assigned to him by Atari co-founder Nolan Bushnell, but Bushnell
                and Atari co-founder Ted Dabney were surprised by the quality of
                Alcorn's work and decided to manufacture the game. Bushnell based
                the game's concept on an electronic ping-pong game included in the
                Magnavox Odyssey, the first home video game console. In response,
                Magnavox later sued Atari for patent infringement.</p>
            <img src="img/console.png" style="margin: 0px auto; display: block; width: 250px; padding-top: 20px;"
                 alt="First Pong Game console"/>
        </div>
    {:else if $intra === 'true'}
        <div>
            <h2>Check your mails for the authentication code !</h2>
            <input style="width: 150px; display: block; margin: 0 auto; margin-bottom: 20px;"
                   type="password" placeholder="2FA code" bind:value={code}/>
            {#if error === true}
                <p style="color: red;">Wrong code number</p>
            {/if}
            <button on:click={sendCode} type="submit" value="Submit">Send
            </button>
        </div>
    {:else}
        <a href={`${BACKEND_URL}/auth/42`} class="api">
            Connect with<br><img src="img/42_logo.png" style='width: 5vw' alt="42 logo"/>
        </a>
    {/if}
</main>

<style>
    main {
        font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
        align-items: center;
        align-content: center;
        text-align: center;
        display: block;
        margin: 30px auto 0;
        color: black;
        min-width: 360px;
    }

    .about {
        color: black;
        width: 60vw;
        margin: 0 auto;
        font-size: calc(0.8em + 1vmin);
        font-style: italic;
        font-weight: 300;
        line-height: 1.7;
        text-align: center;
    }

    .api {
        color: rgb(255, 255, 255);
        text-align: center;
        width: 15vw;
        max-width: 90px;
        min-width: 50px;
        padding: 2vw 8vw;
        align-items: center;
        align-content: center;
        font-size: clamp(13px, 2vw, 16px);
        display: block;
        margin: 30px auto 0;
        background-color: rgb(25, 184, 173);
        line-height: 2;
        font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
    }

    ::-webkit-input-placeholder {
        text-align: center;
    }

    :-moz-placeholder {
        text-align: center;
    }
</style>