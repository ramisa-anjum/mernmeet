// const { Socket } = require('dgram')
const express = require('express')
const path = require("path")
const app = express()

let server = app.listen(3000,function(){
    console.log("Listen on port 3000")
})

const io = require("socket.io")(server)
app.use(express.static(path.join(__dirname,"")))


let userConnection = []
io.on("connection",(socket)=>{
    // console.log("Socket id from server side",socket.id)

    socket.on("userconnect",(dataclient)=>{
        let myid = userConnection.filter((user)=> user.meetingid == dataclient.meetingid)
         userConnection.push({
             connectionId:socket.id,
             username: dataclient.username,
             meetingid: dataclient.meetingid
         })
        
         myid.forEach((item)=>{
             socket.to(item.connectionId).emit("myinformation",{
                 myusername:dataclient.username,
                 connectid: socket.id
             })
         })
    })

    socket.on("SDPprocess",(data)=>{
        socket.to(data.connectionId).emit("SDPprocess"),{
            message: data.message,
            from_connectid: data.connectionId
        }
    })
}) 