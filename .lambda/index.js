'use strict'

const AWS = require('aws-sdk')
const S3 = new AWS.S3({signatureVersion: 'v4'})
const gm = require('gm').subClass({imageMagick: true})
const imagemin = require('imagemin')
const imageminJpegtran = require('imagemin-jpegtran')
const imageminOptipng = require('imagemin-optipng')
const imageminGifsiclet = require('imagemin-gifsicle')
const imageminSvgo = require('imagemin-svgo')

const BUCKET = process.env.BUCKET
const URL = process.env.URL

exports.handler = function (event, context, callback) {
  const key = event.queryStringParameters.key
  const match = key.match(/(\d+)x(\d+)(\^?)\/(.*)/)
  const width = parseInt(match[1], 10)
  const height = parseInt(match[2], 10)
  const arg = match[3]
  const originalKey = match[4]

  S3.getObject({Bucket: BUCKET, Key: originalKey}).promise()
    .then(data => new Promise((resolve, reject) => gm(data.Body, originalKey)
      .resize(width > 0 ? width : null, height > 0 ? height : null, arg)
      .toBuffer((error, buffer) => {
        if (error) { return reject(error) }
        resolve(buffer)
      }))
      .then(buffer => imagemin.buffer(buffer, { plugins: [
        imageminJpegtran(),
        imageminOptipng(),
        imageminGifsiclet(),
        imageminSvgo()
      ]}))
      .then(buffer => S3.putObject({
        Body: buffer,
        Bucket: BUCKET,
        ContentType: data.ContentType,
        Key: key
      }).promise())
    )
    .then(() => callback(null, {
      statusCode: '301',
      headers: {'location': `${URL}/${key}`},
      body: ''
    }))
    .catch(err => callback(err))
}
