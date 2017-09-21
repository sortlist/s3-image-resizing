'use strict'

const AWS = require('aws-sdk')
const S3 = new AWS.S3({signatureVersion: 'v4'})
const Sharp = require('sharp')
const imagemin = require('imagemin')
const imageminJpegtran = require('imagemin-jpegtran')
const imageminOptipng = require('imagemin-optipng')
const imageminGifsiclet = require('imagemin-gifsicle')
const imageminSvgo = require('imagemin-svgo')

const BUCKET = process.env.BUCKET
const URL = process.env.URL

// Imagemin options object for all image types
const imageminOptions = {
  optimizationLevel: +7,
  progressive: true,
  interlaced: true
}

exports.handler = function (event, context, callback) {
  const key = event.queryStringParameters.key
  const match = key.match(/(\d+)x(\d+)\/(.*)/)
  const width = parseInt(match[1], 10)
  const height = parseInt(match[2], 10)
  const originalKey = match[3]

  S3.getObject({Bucket: BUCKET, Key: originalKey}).promise()
    .then(data => Sharp(data.Body)
      .resize(width, height)
      .toFormat('png')
      .toBuffer()
    )
    .then(buffer => imagemin.buffer(buffer, { plugins: [
      imageminJpegtran(),
      imageminOptipng(),
      imageminGifsiclet(),
      imageminSvgo()
    ]}))
    .then(buffer => S3.putObject({
      Body: buffer,
      Bucket: BUCKET,
      ContentType: 'image/png',
      Key: key
    }).promise())
    .then(() => callback(null, {
      statusCode: '301',
      headers: {'location': `${URL}/${key}`},
      body: ''
    }))
    .catch(err => callback(err))
}
