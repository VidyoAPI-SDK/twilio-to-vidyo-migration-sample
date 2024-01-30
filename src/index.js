import * as Video from 'twilio-video';
import { VC } from "vidyoclient-nativewebrtc-sdk";
const loadingPopUp = document.getElementById('loadingPopUp');
const meetingLinkEl = document.getElementById('meetingLink');
let meetingLink = '';

document.getElementById('copyBtn').onclick = () => {
    navigator.clipboard.writeText(meetingLink);
}

document.getElementById('newTabBtn').onclick = () => {
    window.open(meetingLink, '_blank');
}

window.Video = Video;
let provider = process.env.CLIENT_PROVIDER;
if(!['TWILIO', 'VIDYO'].includes(provider)) {
    provider = 'TWILIO';
}

console.info(`Current provider - ${provider}`);
document.getElementById('provider').textContent = `Provider - ${provider}`;

let room;
const remoteParticipantAudios = {};

const wrapVideo = (video, id, dataId) => {
    const div = document.createElement('div');
    div.append(video);
    if(id) {
        div.id = id;
    }
    if(dataId) {
        div.setAttribute('data-id', dataId);
    }
    return div;
}
const characters ='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

const  generateString = (length) => {
    let result = '';
    const charactersLength = characters.length;
    for ( let i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }

    return result;
}

const setMeetingLink = (roomName, portal) => {
    const url = new URL(window.location);
    url.searchParams.set('roomName', roomName);
    if(provider === 'VIDYO') {
        url.searchParams.set('portal', portal);
    }
    window.history.pushState({}, '', url);
    meetingLink = url;
    meetingLinkEl.textContent = meetingLink;
}

const usp = new URLSearchParams(window.location.search);
let roomName = usp.get('roomName') ?? (provider === 'TWILIO' ? `room_${generateString(10)}` : '');
let portal = usp.get('portal') ?? '';
document.getElementById('portal').value = portal;
document.getElementById('room').value = roomName;
document.getElementById('name').value = `User_${generateString(6)}`;

/*
|||||||||||||||||||||||||||| INIT |||||||||||||||||||||||||
*/
/*
_________________________________TWILIO_________________________________
 */
if(provider === 'TWILIO') {
    document.getElementById('renderer').classList.add('twilio');
} else {
    document.getElementById('portal').parentNode.classList.remove('hidden');
}
/*
__________________________________VIDYO_________________________________
 */
let vidyoConnector;
if(provider === 'VIDYO') {
    vidyoConnector = await VC.CreateVidyoConnector({
        viewId: "renderer", // Div ID where the composited video will be rendered, see VidyoConnector.html;
        viewStyle: "VIDYO_CONNECTORVIEWSTYLE_Default", // Visual style of the composited renderer
        remoteParticipants: 8,     // Maximum number of participants to render
        logFileFilter: "debug@VidyoClient debug@VidyoSDP debug@VidyoResourceManager",
        logFileName: "",
        userData: 0,
        constraints: {}
    });
}




/*
|||||||||||||||||||||||||||| RENDER LOCAL VIDEO |||||||||||||||||||||||||
*/
/*
_________________________________TWILIO_________________________________
 */
if(provider === 'TWILIO') {
    const videoTrack = await Video.createLocalVideoTrack();
    const trackElement = wrapVideo(videoTrack.attach());
    window.currentLocalCamera = {
        track: videoTrack,
        trackElement
    };
    document.getElementById('renderer').appendChild(trackElement);
}
/*
__________________________________VIDYO_________________________________
 */
if(provider === 'VIDYO') {
    // nothing to do here, vidyoclient do it automatically
}






/*
|||||||||||||||||||||||||||| SETUP LOCAL MICROPHONE |||||||||||||||||||||||||
*/
/*
_________________________________TWILIO_________________________________
 */
if(provider === 'TWILIO') {
    const audioTrack = await Video.createLocalAudioTrack();
    window.currentLocalMicrophone = {
        track: audioTrack
    };
}
/*
__________________________________VIDYO_________________________________
 */
if(provider === 'VIDYO') {
    // nothing to do here, vidyoclient do it automatically
}









/*
|||||||||||||||||||||||||||| CONNECT/DISCONNECT ROOM |||||||||||||||||||||||||
*/
/*
_________________________________TWILIO_________________________________
 */
if(provider === 'TWILIO') {
    const participantConnected = (participant) => {
        participant.tracks.forEach(publication => {
          if (publication.isSubscribed) {
            if(publication.track.kind === 'video') {
                document.getElementById('renderer').appendChild(wrapVideo(publication.track.attach(), publication.track.sid, participant.sid))
            } else {
                remoteParticipantAudios[participant.sid] = publication.track.attach();
            }
          }
        });
      
        participant.on('trackSubscribed', track => {
            if(track.kind === 'video') {
                document.getElementById('renderer').appendChild(wrapVideo(track.attach(), track.sid, participant.sid))
            } else {
                remoteParticipantAudios[participant.sid] = track.attach();
            }
        });
        participant.on('trackUnsubscribed', (track) => {
            if(track.kind === 'video') {
                document.getElementById(track.sid)?.remove();
            }
        });
        const pelement = document.createElement('div');
        pelement.id = `p_${participant.sid}`;
        pelement.innerText = participant.identity;
        document.getElementById('participants-list').append(pelement);
      };
      
    const participantDisconnected = (participant) => {
        document.querySelectorAll(`div[data-id='${participant.sid}`).forEach(e => e.remove());
        document.getElementById(`p_${participant.sid}`)?.remove();
    };
    const connect = async () => {
        try {
            loadingPopUp.setAttribute('data-text', 'Creating a room...');
            const response = await fetch('/token', {
                method: 'POST',
                headers: {
                'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    'identity': document.getElementById('name').value,
                    'room': roomName
                })
            });
            if(response.status == 400) {
                loadingPopUp.setAttribute('data-text', '');
                alert(JSON.stringify(await response.json()));
                return;
            }
            loadingPopUp.setAttribute('data-text', 'Joining a call...');
            const data = await response.json();
            room = await Video.connect(data.token);
            room.participants.forEach(participantConnected);
            room.on('participantConnected', participantConnected);
            room.on('participantDisconnected', participantDisconnected);
            room.on('disconnected', (room, error) => {
                if(error) {
                    alert(error);
                }
                document.getElementById('participants-list').innerHTML = '';
                document.body.classList.remove('in-call');
            });
            document.body.classList.add('in-call');
            loadingPopUp.setAttribute('data-text', '');
            setMeetingLink(roomName);
        } catch(e) {
            alert(e);
        }
        
    };

    const disconnect = async () => {
        room.disconnect();
        document.getElementById('participants-list').innerHTML = '';
        loadingPopUp.setAttribute('data-text', '');
        document.body.classList.remove('in-call');
    };

    document.getElementById('btnStart').onclick = () => connect();
    document.getElementById('btnEnd').onclick = () => disconnect();
}
/*
__________________________________VIDYO_________________________________
 */ 
if(provider === 'VIDYO') {
    const connect = async () => {

        portal = document.getElementById('portal').value;
        roomName = document.getElementById('room').value;
        
        await vidyoConnector.ConnectToRoomAsGuest({
            host: portal,
            roomKey: roomName,
            displayName: document.getElementById('name').value,
            roomPin: '',
            onSuccess: function() {
                document.body.classList.add('in-call');
                loadingPopUp.setAttribute('data-text', '');
                setMeetingLink(roomName, portal);
                vidyoConnector.RegisterParticipantEventListener({
                    onJoined: function(participant) {
                        const pelement = document.createElement('div');
                        pelement.id = `p_${participant.objId}`;
                        pelement.innerText = participant.name;
                        document.getElementById('participants-list').append(pelement);
                    },
                    onLeft: function(participant) {
                        document.getElementById(`p_${participant.objId}`)?.remove();
                    },
                    onDynamicChanged: function(participants, cameras) {
                    },
                    onLoudestChanged: function(participant, audioOnly) {
                    }
                }).catch(function() {
                    
                });
            },
            onFailure: function(reason) {
            alert(reason);
                loadingPopUp.setAttribute('data-text', '');
            },
            onDisconnected: function(reason) {
                document.getElementById('participants-list').innerHTML = '';
                document.body.classList.remove('in-call');
                loadingPopUp.setAttribute('data-text', '');
            }
        })
    };
    const disconnect = () => vidyoConnector.Disconnect();
    document.getElementById('btnStart').onclick = () => connect();
    document.getElementById('btnEnd').onclick = () => disconnect();
}







/*
|||||||||||||||||||||||||||| FILL CAMERAS LIST |||||||||||||||||||||||||
*/
/*
_________________________________TWILIO_________________________________
 */
if(provider === 'TWILIO') {
    const cameraSelect = document.getElementById('cameraSelect')
    const fillCameras = () => {
        cameraSelect.innerHTML = '';
        navigator.mediaDevices.enumerateDevices().then(devices => {
            const cameras = devices.filter(device => device.kind === 'videoinput');
            cameras.forEach(camera => {
                const option = new Option(camera.label, camera.deviceId);
                cameraSelect.append(option);
            })
        });
    }
    navigator.mediaDevices.addEventListener('devicechange', () => fillCameras());
    fillCameras();
}
/*
__________________________________VIDYO_________________________________
 */
if(provider === 'VIDYO') {
    const cameraSelect = document.getElementById('cameraSelect')
    window.cameras = [];
    vidyoConnector.RegisterLocalCameraEventListener({
        onAdded: function(localCamera) {
            const option = new Option(localCamera.name, localCamera.id);
            cameraSelect.append(option);
            window.cameras[localCamera.id] = localCamera;

        },
        onRemoved: function(localCamera) {
            document.querySelector(`option[value='${localCamera.id}']`)?.remove();
            window.cameras[localCamera.id];
        },
        onSelected: function(localCamera) {
            console.log("local camera selected", localCamera);
        },
        onStateUpdated: function(localCamera, state) {
            console.log("local camera state changed", localCamera, state);
        }
    }).then(function() {
        console.log("RegisterLocalCameraEventListener Success");
    }).catch(function() {
        console.error("RegisterLocalCameraEventListener Failed");
    });
}




/*
|||||||||||||||||||||||||||| FILL MICROPHONES LIST |||||||||||||||||||||||||
*/
/*
_________________________________TWILIO_________________________________
 */
if(provider === 'TWILIO') {
    const microphoneSelect = document.getElementById('microphoneSelect')
    const fillMics = () => {
        microphoneSelect.innerHTML = '';
        navigator.mediaDevices.enumerateDevices().then(devices => {
            const mics = devices.filter(device => device.kind === 'audioinput');
            mics.forEach(mic => {
                const option = new Option(mic.label, mic.deviceId);
                microphoneSelect.append(option);
            })
        });
    }
    navigator.mediaDevices.addEventListener('devicechange', () => fillMics());
    fillMics();
}
/*
__________________________________VIDYO_________________________________
 */
if(provider === 'VIDYO') {
    const microphoneSelect = document.getElementById('microphoneSelect')
    window.microphones = [];
    vidyoConnector.RegisterLocalMicrophoneEventListener({
        onAdded: function(localMicrophone) {
            const option = new Option(localMicrophone.name, localMicrophone.id);
            microphoneSelect.append(option);
            window.microphones[localMicrophone.id] = localMicrophone;
        },
        onRemoved: function(localMicrophone) {
            document.querySelector(`option[value='${localMicrophone.id}']`)?.remove();
            window.microphones[localMicrophone.id];
        },
        onSelected: function(localMicrophone) {
            console.log("local microphone selected", localMicrophone);
        },
        onStateUpdated: function(localMicrophone, state) {
            console.log("local microphone state changed", localMicrophone, state);
        }
    }).then(function() {
        console.log("RegisterLocalMicrophoneEventListener Success");
    }).catch(function() {
        console.error("RegisterLocalMicrophoneEventListener Failed");
    });
}








/*
|||||||||||||||||||||||||||| FILL SPEAKERS LIST |||||||||||||||||||||||||
*/
/*
_________________________________TWILIO_________________________________
 */
if(provider === 'TWILIO') {
    const speakerSelect = document.getElementById('speakerSelect')
    const fillSpeakers = () => {
        speakerSelect.innerHTML = '';
        navigator.mediaDevices.enumerateDevices().then(devices => {
            const speakers = devices.filter(device => device.kind === 'audiooutput');
            speakers.forEach(speaker => {
                const option = new Option(speaker.label, speaker.deviceId);
                speakerSelect.append(option);
            })
        });
    }
    navigator.mediaDevices.addEventListener('devicechange', () => fillSpeakers());
    fillSpeakers();
}
/*
__________________________________VIDYO_________________________________
 */ 
if(provider === 'VIDYO') {
    const speakerSelect = document.getElementById('speakerSelect')
    window.speakers = [];
    vidyoConnector.RegisterLocalSpeakerEventListener({
        onAdded: function(localSpeaker) {
            const option = new Option(localSpeaker.name, localSpeaker.id);
            speakerSelect.append(option);
            window.speakers[localSpeaker.id] = localSpeaker;
        },
        onRemoved: function(localSpeaker) {
            document.querySelector(`option[value='${localSpeaker.id}']`)?.remove();
            window.speakers[localSpeaker.id];
        },
        onSelected: function(localSpeaker) {
            console.log("local speaker selected", localSpeaker);
        },
        onStateUpdated: function(localSpeaker, state) {
            console.log("local speaker state changed", localSpeaker, state);
        }
    }).then(function() {
        console.log("RegisterLocalSpeakerEventListener Success");
    }).catch(function() {
        console.error("RegisterLocalSpeakerEventListener Failed");
    });
}











/*
|||||||||||||||||||||||||||| MUTE CAMERA |||||||||||||||||||||||||
*/
/*
_________________________________TWILIO_________________________________
 */
if(provider === 'TWILIO') {
    document.getElementById('cameraOn').onclick = () => {
        room?.localParticipant.videoTracks.forEach(track => {
            track.track.disable();
        });
        document.getElementById('cameraOn').classList.add('hidden');
        document.getElementById('cameraOff').classList.remove('hidden');
    }

    document.getElementById('cameraOff').onclick = () => {
        room?.localParticipant.videoTracks.forEach(track => {
            track.track.enable();
        });
        document.getElementById('cameraOn').classList.remove('hidden');
        document.getElementById('cameraOff').classList.add('hidden');
    }
}
/*
__________________________________VIDYO_________________________________
 */ 
if(provider === 'VIDYO') {
    document.getElementById('cameraOn').onclick = () => {
        vidyoConnector.SetCameraPrivacy({privacy: true});
        document.getElementById('cameraOn').classList.add('hidden');
        document.getElementById('cameraOff').classList.remove('hidden');
    }

    document.getElementById('cameraOff').onclick = () => {
        vidyoConnector.SetCameraPrivacy({privacy: false});
        document.getElementById('cameraOn').classList.remove('hidden');
        document.getElementById('cameraOff').classList.add('hidden');
    }
}











/*
|||||||||||||||||||||||||||| MUTE MICROPHONE |||||||||||||||||||||||||
*/
/*
_________________________________TWILIO_________________________________
 */
if(provider === 'TWILIO') {
    document.getElementById('micOn').onclick = () => {
        room?.localParticipant.audioTracks.forEach(track => {
            track.track.disable();
        });
        document.getElementById('micOn').classList.add('hidden');
        document.getElementById('micOff').classList.remove('hidden');
    }

    document.getElementById('micOff').onclick = () => {
        room?.localParticipant.audioTracks.forEach(track => {
            track.track.enable();
        });
        document.getElementById('micOn').classList.remove('hidden');
        document.getElementById('micOff').classList.add('hidden');
    }
}
/*
__________________________________VIDYO_________________________________
 */ 
if(provider === 'VIDYO') {
    document.getElementById('micOn').onclick = () => {
        vidyoConnector.SetMicrophonePrivacy({privacy: true});
        document.getElementById('micOn').classList.add('hidden');
        document.getElementById('micOff').classList.remove('hidden');
    }

    document.getElementById('micOff').onclick = () => {
        vidyoConnector.SetMicrophonePrivacy({privacy: false});
        document.getElementById('micOn').classList.remove('hidden');
        document.getElementById('micOff').classList.add('hidden');
    }
}










/*
|||||||||||||||||||||||||||| MUTE SPEAKER |||||||||||||||||||||||||
*/
/*
_________________________________TWILIO_________________________________
 */
if(provider === 'TWILIO') {
    document.getElementById('speakerOn').onclick = () => {
        Object.values(remoteParticipantAudios).forEach(a => a.muted = true);
        document.getElementById('speakerOn').classList.add('hidden');
        document.getElementById('speakerOff').classList.remove('hidden');
    }

    document.getElementById('speakerOff').onclick = () => {
        Object.values(remoteParticipantAudios).forEach(a => a.muted = false);
        document.getElementById('speakerOn').classList.remove('hidden');
        document.getElementById('speakerOff').classList.add('hidden');
    }
}
/*
__________________________________VIDYO_________________________________
 */ 
if(provider === 'VIDYO') {
    document.getElementById('speakerOn').onclick = () => {
        vidyoConnector.SetSpeakerPrivacy({privacy: true});
        document.getElementById('speakerOn').classList.add('hidden');
        document.getElementById('speakerOff').classList.remove('hidden');
    }

    document.getElementById('speakerOff').onclick = () => {
        vidyoConnector.SetSpeakerPrivacy({privacy: false});
        document.getElementById('speakerOn').classList.remove('hidden');
        document.getElementById('speakerOff').classList.add('hidden');
    }
}








/*
|||||||||||||||||||||||||||| SELECT CAMERA |||||||||||||||||||||||||
*/
/*
_________________________________TWILIO_________________________________
 */
if(provider === 'TWILIO') {
    document.getElementById('cameraSelect').onchange = async ({target} = event) => {
        if(window.currentLocalCamera) {
            window.currentLocalCamera.trackElement.remove();
            window.currentLocalCamera.track.stop(); 
        }
        const videoTrack = await Video.createLocalVideoTrack({deviceId: target.value});
        const trackElement = wrapVideo(videoTrack.attach());
        window.currentLocalCamera = {
            track: videoTrack,
            trackElement
        };
        document.getElementById('renderer').appendChild(trackElement);
        if(room) {
            room.localParticipant.videoTracks.forEach(publication => {
                publication.track.stop();
                room.localParticipant.unpublishTrack(publication.track);
              });
            room.localParticipant.publishTrack(videoTrack);
        }
    }
}
/*
__________________________________VIDYO_________________________________
 */ 
if(provider === 'VIDYO') {
    document.getElementById('cameraSelect').onchange = ({target} = event) => {
        if(window.cameras[target.value]) {
            vidyoConnector.SelectLocalCamera({localCamera: window.cameras[target.value]});
        }
    }
}







/*
|||||||||||||||||||||||||||| SELECT MICROPHONE |||||||||||||||||||||||||
*/
/*
_________________________________TWILIO_________________________________
 */
if(provider === 'TWILIO') {
    document.getElementById('microphoneSelect').onchange = async ({target} = event) => {
        window.currentLocalMicrophone?.track?.stop(); 
        const audioTrack = await Video.createLocalAudioTrack({deviceId: target.value});
        window.currentLocalMicrophone = {
            track: audioTrack,
        };
        if(room) {
            room.localParticipant.audioTracks.forEach(publication => {
                publication.track.stop();
                room.localParticipant.unpublishTrack(publication.track);
              });
            room.localParticipant.publishTrack(audioTrack);
        }
    }
}
/*
__________________________________VIDYO_________________________________
 */ 
if(provider === 'VIDYO') {
    document.getElementById('microphoneSelect').onchange = ({target} = event) => {
        if(window.microphones[target.value]) {
            vidyoConnector.SelectLocalMicrophone({localMicrophone: window.microphones[target.value]});
        }
    }
}






/*
|||||||||||||||||||||||||||| SELECT SPEAKER |||||||||||||||||||||||||
*/
/*
_________________________________TWILIO_________________________________
 */
if(provider === 'TWILIO') {
    document.getElementById('speakerSelect').onchange = ({target} = event) => {
        Object.values(remoteParticipantAudios).forEach(a => a.setSinkId(target.value));
    }
}
/*
__________________________________VIDYO_________________________________
 */ 
if(provider === 'VIDYO') {
    document.getElementById('speakerSelect').onchange = ({target} = event) => {
        if(window.speakers[target.value]) {
            vidyoConnector.SelectLocalSpeaker({localSpeaker: window.speakers[target.value]});
        }
    }
}






/*
|||||||||||||||||||||||||||| WINDOW SHARE |||||||||||||||||||||||||
*/
/*
_________________________________TWILIO_________________________________
 */
if(provider === 'TWILIO') {
    document.getElementById('share').onclick = async () => {
        if(room) {
            try {
                const shareStream = await navigator.mediaDevices.getDisplayMedia();
                const screenTrack = new Video.LocalVideoTrack(shareStream.getTracks()[0], {name:'screen'});
                room.localParticipant.publishTrack(screenTrack);
                shareStream.getVideoTracks()[0].onended = () => {
                    room?.localParticipant?.unpublishTrack(screenTrack);
                }
            }   catch(e) {}
        } 
    }
}
/*
__________________________________VIDYO_________________________________
 */ 
if(provider === 'VIDYO') {
    document.getElementById('share').onclick = ({target} = event) => {
        vidyoConnector.RegisterLocalWindowShareEventListener({
            onAdded: function(localWindowShare) {
                vidyoConnector.SelectLocalWindowShare({
                    localWindowShare,
                  });
            },
            onRemoved: function(localWindowShare) {
            },
            onSelected: function(localWindowShare) {
            },
            onStateUpdated: function(localWindowShare, state) {
                // localWindowShare state was updated
            }
        }).catch(function() {
            console.error("RegisterLocalWindowShareEventListener Failed");
        });
    }
}

