## Automating Google Earth Engine exports with Cloud Scheduler

Executing operations with consistent frequency is a common task in many satellite remote sensing frameworks, e.g., weekly estimates of crop production or daily detection of burned areas. Once developed, such routines can be automated to simplify execution and delivery. The following is a simple example of using Cloud Scheduler to automate the export of 16-day Landsat NDVI composites in Earth Engine.

### Requirements
* Earth Engine access
* A Google Cloud project with billing enabled, and the Cloud Build, Cloud Functions, Cloud Scheduler, Earth Engine, and Pub/Sub APIs enabled
* [An Earth Engine authorized service account](https://developers.google.com/earth-engine/service_account)

#### Earth Engine
[Earth Engine](https://earthengine.google.com/) is Google's geospatial platform for earth science data and analysis. 16-day Landsat NDVI was prototyped in the [Earth Engine code editor](https://code.earthengine.google.com/356caedb05a6c7505a6faaf98ac99e29?noload=true). Landsat 8 and 9 were used; pixels were bilinearly resampled; and cloudy and saturated pixels were masked. NDVI can be calculated for any given region, year, and day of year: `ndviComposite(region, year, doy)`.

*Note:* There is no attempt to fill in missing pixels due to clouds or missing Landsat scenes. 

#### Cloud Functions
[Cloud Functions](https://cloud.google.com/functions) is a serverless environment for connecting cloud services. In this case, Cloud Functions can be used to execute Earth Engine code. 

The Node.js runtime was used for easy transferability from the code editor to the cloud function. The Landsat functions were placed in the `helper.js` file. Cloud Scheduler uses the unix-cron format to define schedules; although highly customizable, the unix-cron format cannot define a consistent 16-day schedule. Additional functions and logic were created to ensure that NDVI composites were created on the appropriate day. To simplify, 16-day periods and year were pre-defined. 

`var year = 2022;`  
`var doys = [1, 17, 33, 49, 65, 81, 97, 113, 129, 145, 161, 177, 193, 
          209, 225, 241, 257, 273, 289, 305, 321, 337, 353];`

Necessary files:  
**function.js** - Primary function, exports NDVI composite to an Earth Engine asset three days after the end of a 16-day period.  
**helpers.js** - Helper functions: Landsat masking, day of year calculation, etc.  
**package.json** - npm package file.  
**eeKey.json** - Service account key (not provided).

*Note:* Error catching, failure/success notification, or retry were not implemented as part of the function. These would be recommended in an actual deployment.

#### Pub/Sub
[Pub/Sub](https://cloud.google.com/pubsub) is a messaging service for communication between services. The function will subscribe to a Pub/Sub topic, and will be executed when an event is triggered.

#### Cloud Scheduler
[Cloud Scheduler](https://cloud.google.com/scheduler) is a fully managed cron job service. It uses cron schedules to automate tasks. The scheduler will invoke the Pub/Sub trigger.

#### Putting it all together
The [gcloud CLI](https://cloud.google.com/sdk/gcloud) can be used to put all the pieces together.

Set the default cloud project  
`gcloud config set project PROJECT-NAME`

Create the Pub/Sub topic  
`gcloud pubsub topics create TOPIC-NAME`

Deploy and subscribe the function to the Pub/Sub topic  
`gcloud functions deploy FUNCTION-NAME --trigger-topic TOPIC-NAME --runtime nodejs12 --timeout=120`

Create the Cloud Scheduler job to invoke the Pub/Sub trigger. The job will be run every day at 10:00 Central time. The cloud function itself will determine if the NDVI composite will be created. A message body is required. 
`gcloud scheduler jobs create pubsub JOB-NAME --schedule="0 10 * * *" --topic=TOPIC-NAME --time-zone=America/Chicago --message-body="execute"`

Manually run the Cloud Scheduler job.  
`gcloud scheduler jobs run JOB-NAME`

Check the the logs for the function. It may take a few minutes for the logs to be updated.  
`gcloud functions logs read FUNCTION-NAME`  
Most days the log will simply read `no exports`, but on days the export is initiated, the logs will provide Earth Engine task information:

> today DOY: 116  
16-day periods: [ 97, 113 ]  
year: 2022  
task: LOUAKNHAQWN4AWZ7D4ECDG2K
