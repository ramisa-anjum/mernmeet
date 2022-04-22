let videoProcess= (function(){
let peers_connection_ids =[]
let peers_connection = []
let remote_video_stream = []
let remote_audio_stream = []
let audio_sender = []
let local_div;
let audio;
let isAudioMute;
let video_state={
    none:0,
    camera:1,
    screenshare:2,
}
let videoCameraTrack;
let video_st= video_state.none

let serverProcess;
    async function init(SDPfunction,myid){
        serverProcess = SDPfunction
        myconnectionid = myid
        eventProcess()
        local_div = document.getElementById("localvideo")
    }
    function eventProcess(){
        $("#micOnOff").click(async function(){
            if(!audio){
                await loadAudio()
            }
            if(!audio){
                alert("Audio permission has not granted")
            }
            if(isAudioMute){
                audio.enabled = true
                $("#micOnOff").html('<i class="fas fa-microphone"></i>')
                updateMediaSender(audio,audio_sender)
            }else{
                $("#micOnOff").html('<i class="fas fa-microphone-slash"></i>')
                removeMediaSender(audio_sender)
            }
            isAudioMute=!isAudioMute
        })
        $("#videoOnOff").click(async function(){
            if(video_st == video_state.camera){
                await deviceVideoProcess(video_state.none)
            }else{
                await deviceVideoProcess(video_state.camera)
            }
        })
        $("#shareOnOff").click(async function(){
            if(video_st == video_state.screenshare){
                await deviceVideoProcess(video_state.none)
            }else{
                await deviceVideoProcess(video_state.screenshare)
            }
        })
    }
    async function deviceVideoProcess(newVideoState){
        try{
            let vstream = null
            if(newVideoState == video_state.camera){
                vstream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width:1920,
                        height:1080
                    },
                    audio:false,
                })
            }else if(newVideoState == video_state.screenshare){
                vstream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        width:1920,
                        height:1080,
                    },
                    audio:false,
                })
            }
            if(vstream && vstream.getVideoTracks.length > 0){
                videoCameraTrack = vstream.getVideoTracks()[0]
                if(videoCameraTrack){
                    local_div.srcObject = new MediaStream([videoCameraTrack])
                }
            }
        }catch(err){
            console.log(err)
            return;
        }
        video_st=newVideoState
    }

    let configaration={
        connectionServer:[
            {
                urls:"stun:stun.l.google.com:19302"
            },
            {
                urls:"stun:stun1.l.google.com:19302"
            }
        ]
    }

    async function setConnection(connectid){
        let connection = new RTCPeerConnection(configaration)
        connection.onnegotiationneeded= async function(event){
            await setOffer(connectid)
        }
        connection.onicecandidate = function(event){
            if(event.candidate){
                serverProcess(JSON.stringify({iceCandidate:event.candidate}),connectid)
            } 
        }
        connection.ontrack = function(event){
            if(!remote_video_stream[connectid]){
                remote_video_stream[connectid] = new MediaStream()
            } 
            if(!remote_audio_stream[connectid]){
                remote_audio_stream[connectid] = new MediaStream()
            }
            if(event.track.kind == "video"){
                remote_video_stream[connectid].getVideoTracks()
                .forEach((t)=> remote_video_stream[connectid].removeTrack(t))
                remote_video_stream[connectid].addTrack(event.track)

                let remoteVideo=document.getElementById("video_"+connectid)
                remoteVideo.srcObject= null
                remoteVideo.srcObject=remote_video_stream[connectid]
                remoteVideo.load()
            }else if(event.track.kind == "audio"){
                remote_audio_stream[connectid].getAudioTracks()
                .forEach((t)=> remote_audio_stream[connectid].removeTrack(t))
                remote_audio_stream[connectid].addTrack(event.track)

                let remoteAudio=document.getElementById("audio_"+connectid)
                remoteAudio.srcObject= null
                remoteAudio.srcObject=remote_audio_stream[connectid]
                remoteAudio.load()
            }

        } 
        peers_connection_ids[connectid] = connectid
        peers_connection[connectid] = connection
        
        return connection
    }
    async function setOffer(connectionId){
        let connection = peers_connection[connectid]
        let offer = await connection.createOffer()
        await connection.setLocalDescription(offer)
        serverProcess(JSON.stringify({offer:connection.localDescription}),connectionId)
    }

    async function SDPprocess(message,from_id){
        message = JSON.parse(message)
        if(message.answer){
            peers_connection(from_id).setRemoteDescription(new RTCSessionDescription(message.answer))
        }else if(message.offer){
            if(!peers_connection(from_id)){
                await setConnection(from_id)
            }
            peers_connection(from_id).setRemoteDescription(new RTCSessionDescription(message.offer))

            let answer= await  peers_connection(from_id).createAnswer();
            await  peers_connection(from_id).setLocalDescription(answer)
            serverProcess(JSON.stringify({answer:answer}),from_id)
        }else if(message.icecandidate){
            if(!peers_connection(from_id)){
                await setConnection(from_id)
            }
            try{
                await peers_connection(from_id).addIceCandidate(message.icecandidate)
            }catch(err){
                console.log(err)
            }
        }
    }

    return {
        setNewVideoConnection :async function(connectid){
            await setConnection(connectid)
        },
        init: async function (SDPfunction,myid){
            await init(SDPfunction,myid)

        },
        processClient: async function(data,connectid){
            await SDPprocess(data,connectid)

        }
    }
})()

let myvideoapp = (
    function(){
        function init(username,meetingid){
            userConnectionFromClint(username,meetingid)
        }

        let socket = null
        function userConnectionFromClint(username,meetingid){
            socket=io.connect()
            function SDPfunction(data,connectionId){
                socket.emit("SDPprocess",{
                    message:data,
                    connectionId:connectionId
                })
            }
            socket.on("connect",()=>{
                videoProcess.init(SDPfunction,socket.id)
               if(socket.connected){
                   if(username != "" && meetingid != ""){
                       socket.emit("userconnect",{
                           username:username,
                           meetingid:meetingid
                       })
                   }
               }
            })

            socket.on("myinformation",(dataserver)=>{
                adduservideo(dataserver.myusername,dataserver.connectid)
                // setNewVideoConnection(dataserver.connectid)
                videoProcess.setNewVideoConnection(dataserver.connectid)
            })

            socket.on("SDPprocess",async function(data){
                await videoProcess.processClient(data.message,data.from_connectid)
            })

            function adduservideo(myusername,connectid){
                let newuservideo=$("#otherself").clone()
                // console.log(newuservideo)
                newuservideo = newuservideo.attr("id",connectid).addClass("other")
                newuservideo.find("h1").text(myusername).addClass("text-color")
                newuservideo.find("video").attr("id",`video_${connectid}`)
                newuservideo.find("audio").attr("id",`audio_${connectid}`)
                newuservideo.show()
                $(".top-remote-video").append(newuservideo)
            }
        }
        return{
            init: function(username,meetingid){
                init(username,meetingid)
            }
        }
    }
)()