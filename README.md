### modifyed from urdf-loaders 
front-end for visualizing

usage:

in remote llm server:
    python HRI_mllm/inference/text_response_server.py

in 4 terminals:

    ssh -L 6000:localhost:5000 root@36.103.180.174
    node proxyServer.js
    node server.js

    npm start



curl -X POST http://127.0.0.1:6000/generate-files -d '{"text":"What do you usually do on weekends1?"}' -H "Content-Type: application/json"


# urdf-loaders

URDF loading code in both [C# for Unity](./unity/Assets/URDFLoader/) and [Javascript for THREE.js](./javascript/), as well as example [JPL ATHLETE](https://en.wikipedia.org/wiki/ATHLETE) URDF files

[Demo Here!](https://gkjohnson.github.io/urdf-loaders/javascript/example/bundle/)

![Example](./unity/Assets/docs/asset%20store/all-urdfs.png)

### Flipped Models

The `_flipped` variants of the URDF ATHLETE models invert the revolute joint axes to model ATHLETE in a configuration with the legs attached to the bottom of the chassis.

# LICENSE

The software is available under the [Apache V2.0 license](./LICENSE).

Copyright © 2020 California Institute of Technology. ALL RIGHTS
RESERVED. United States Government Sponsorship Acknowledged.
Neither the name of Caltech nor its operating division, the
Jet Propulsion Laboratory, nor the names of its contributors may be
used to endorse or promote products derived from this software
without specific prior written permission.
